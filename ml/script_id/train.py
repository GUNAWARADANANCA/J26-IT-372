"""Train the Sinhala / Tamil / Latin script-identification CNN and export it to ONNX.

    ml/.venv/Scripts/python ml/script_id/render_dataset.py   # once
    ml/.venv/Scripts/python ml/script_id/train.py

* Model: 5 conv blocks + global average pooling (~0.4 M parameters), so it runs
  in a few milliseconds per line on the counter PC's CPU through ONNX Runtime.
* Selection: best validation accuracy (validation uses training fonts, unseen text).
* Calibration: temperature scaling fitted on validation logits (Guo et al., 2017),
  reported as expected calibration error (ECE) before/after on the test split.
* Test: held-out fonts *and* unseen text (see render_dataset.py).

Artefacts:
  backend/models/script_id.onnx, backend/models/script_id.meta.json
  ml/reports/script_id/metrics.json, REPORT.md, confusion_matrix.png
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_MODELS, BACKEND_ROOT, PROCESSED, REPORTS, ensure  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.ocr.script_id import CLASSES, INPUT_H, INPUT_W  # noqa: E402

DATA = PROCESSED / "script_id"
OUT = REPORTS / "script_id"


class ScriptNet(nn.Module):
    def __init__(self, n_classes: int = 3):
        super().__init__()

        def block(cin, cout):
            return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True))

        self.features = nn.Sequential(
            block(1, 32), nn.MaxPool2d(2),
            block(32, 64), nn.MaxPool2d(2),
            block(64, 128), block(128, 128), nn.MaxPool2d(2),
            block(128, 192), nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Dropout(0.3), nn.Linear(192, n_classes))

    def forward(self, x):
        return self.head(self.features(x))


def load(split: str):
    d = np.load(DATA / f"{split}.npz")
    x = (d["x"].astype(np.float32) / 255.0 - 0.5) / 0.5
    meta = [json.loads(m) for m in d["meta"]]
    return torch.from_numpy(x[:, None]), torch.from_numpy(d["y"]), meta


def online_augment(x: torch.Tensor) -> torch.Tensor:
    """Cheap GPU-side augmentation on top of the rendered variety."""
    b = x.shape[0]
    shifts = torch.randint(-12, 13, (b,), device=x.device)
    x = torch.stack([torch.roll(x[i], int(shifts[i]), dims=-1) for i in range(b)])
    contrast = torch.empty(b, 1, 1, 1, device=x.device).uniform_(0.7, 1.2)
    x = (x * contrast).clamp(-1, 1)
    erase = torch.rand(b, device=x.device) < 0.2
    for i in torch.nonzero(erase).flatten().tolist():
        w = int(torch.randint(8, 48, (1,)))
        s = int(torch.randint(0, INPUT_W - w, (1,)))
        x[i, :, :, s:s + w] = x[i].max()
    return x


@torch.no_grad()
def logits_of(model, x, device, bs=512):
    model.eval()
    out = [model(x[i:i + bs].to(device)).float().cpu() for i in range(0, len(x), bs)]
    return torch.cat(out)


def fit_temperature(logits: torch.Tensor, y: torch.Tensor) -> float:
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(logits / log_t.exp(), y)
        loss.backward()
        return loss
    opt.step(closure)
    return float(log_t.exp())


def ece(probs: torch.Tensor, y: torch.Tensor, bins: int = 15) -> float:
    conf, pred = probs.max(1)
    correct = (pred == y).float()
    edges = torch.linspace(0, 1, bins + 1)
    total = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            total += m.float().mean().item() * abs(conf[m].mean().item() - correct[m].mean().item())
    return round(total, 4)


def per_class(y_true, y_pred) -> dict:
    out = {}
    for i, c in enumerate(CLASSES):
        tp = int(((y_pred == i) & (y_true == i)).sum())
        fp = int(((y_pred == i) & (y_true != i)).sum())
        fn = int(((y_pred != i) & (y_true == i)).sum())
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        out[c] = {"precision": round(p, 4), "recall": round(r, 4), "f1": round(2 * p * r / (p + r) if p + r else 0, 4),
                  "support": tp + fn}
    return out


def confusion(y_true, y_pred) -> list[list[int]]:
    m = np.zeros((len(CLASSES), len(CLASSES)), dtype=int)
    for t, p in zip(y_true, y_pred):
        m[t, p] += 1
    return m.tolist()


def save_confusion_png(matrix, path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(4, 3.6))
    m = np.array(matrix)
    ax.imshow(m, cmap="Blues")
    ax.set_xticks(range(len(CLASSES)), ["Sinhala", "Tamil", "Latin"])
    ax.set_yticks(range(len(CLASSES)), ["Sinhala", "Tamil", "Latin"])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    for i in range(len(CLASSES)):
        for j in range(len(CLASSES)):
            ax.text(j, i, str(m[i, j]), ha="center", va="center", color="white" if m[i, j] > m.max() / 2 else "black")
    ax.set_title("Script ID - held-out fonts")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def train_one(xtr, ytr, xva, yva, device, args):
    """Train one model; keep the epoch with the best validation accuracy."""
    model = ScriptNet(len(CLASSES)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    steps = args.epochs * ((len(xtr) + args.batch_size - 1) // args.batch_size)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.15)
    best_acc, best_state, history = -1.0, None, []
    t0 = time.time()
    for epoch in range(1, args.epochs + 1):
        model.train()
        perm = torch.randperm(len(xtr))
        running = 0.0
        for i in range(0, len(xtr), args.batch_size):
            idx = perm[i:i + args.batch_size]
            xb = online_augment(xtr[idx].to(device))
            yb = ytr[idx].to(device)
            loss = F.cross_entropy(model(xb), yb, label_smoothing=0.05)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            running += loss.item() * len(idx)
        val_acc = (logits_of(model, xva, device).argmax(1) == yva).float().mean().item()
        history.append({"epoch": epoch, "train_loss": round(running / len(xtr), 4), "val_acc": round(val_acc, 4)})
        print(f"  epoch {epoch:2d} loss {running / len(xtr):.4f} val_acc {val_acc:.4f}")
        if val_acc > best_acc:
            best_acc, best_state = val_acc, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    return model, best_acc, history, time.time() - t0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--epochs", type=int, default=14)
    ap.add_argument("--batch-size", type=int, default=128)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--seeds", type=int, nargs="+", default=[5, 6, 7],
                    help="one model per seed; the best on VALIDATION is shipped, test is reported as mean +/- SD")
    args = ap.parse_args()
    ensure(OUT, BACKEND_MODELS)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device} ({torch.cuda.get_device_name(0) if device.type == 'cuda' else 'cpu'})")

    xtr, ytr, _ = load("train")
    xva, yva, _ = load("val")
    xte, yte, mte = load("test")
    print(f"train {tuple(xtr.shape)} val {tuple(xva.shape)} test {tuple(xte.shape)}")
    y = yte.numpy()
    handwriting = np.array([m["style"] == "handwriting" for m in mte])

    runs = []
    for seed in args.seeds:
        torch.manual_seed(seed)
        np.random.seed(seed)
        model, best_acc, history, train_seconds = train_one(xtr, ytr, xva, yva, device, args)
        test_pred = logits_of(model, xte, device).argmax(1).numpy()
        runs.append({"seed": seed, "model": model, "best_val_accuracy": best_acc, "history": history,
                     "train_seconds": train_seconds, "test_accuracy": float((test_pred == y).mean()),
                     "test_handwriting_accuracy": float((test_pred[handwriting] == y[handwriting]).mean())})
        print(f"seed {seed}: val {best_acc:.4f} test {runs[-1]['test_accuracy']:.4f} "
              f"handwriting {runs[-1]['test_handwriting_accuracy']:.4f}")
    chosen = max(runs, key=lambda r: r["best_val_accuracy"])  # selection never looks at the test split
    model, best_acc, history, train_seconds = chosen["model"], chosen["best_val_accuracy"], chosen["history"], chosen["train_seconds"]
    n_params = sum(p.numel() for p in model.parameters())
    seed_summary = {
        "seeds": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items() if k not in ("model", "history")}
                  for r in runs],
        "chosen_seed": chosen["seed"],
        "test_accuracy_mean": round(float(np.mean([r["test_accuracy"] for r in runs])), 4),
        "test_accuracy_sd": round(float(np.std([r["test_accuracy"] for r in runs], ddof=1)) if len(runs) > 1 else 0.0, 4),
        "handwriting_accuracy_mean": round(float(np.mean([r["test_handwriting_accuracy"] for r in runs])), 4),
        "handwriting_accuracy_sd": round(float(np.std([r["test_handwriting_accuracy"] for r in runs], ddof=1)) if len(runs) > 1 else 0.0, 4),
    }

    val_logits = logits_of(model, xva, device)
    temperature = fit_temperature(val_logits, yva)
    test_logits = logits_of(model, xte, device)
    probs_raw = F.softmax(test_logits, 1)
    probs_cal = F.softmax(test_logits / temperature, 1)
    pred = test_logits.argmax(1).numpy()
    y = yte.numpy()

    by_style, by_font = defaultdict(list), defaultdict(list)
    for m, p, t in zip(mte, pred, y):
        by_style[m["style"]].append(p == t)
        by_font[m["font"]].append(p == t)

    # ---- ONNX export + parity check -------------------------------------------------
    onnx_path = BACKEND_MODELS / "script_id.onnx"
    model_cpu = model.to("cpu").eval()
    dummy = torch.zeros(1, 1, INPUT_H, INPUT_W)
    torch.onnx.export(model_cpu, dummy, str(onnx_path), input_names=["image"], output_names=["logits"],
                      dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17, dynamo=False)
    import onnxruntime as ort
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    sample = xte[:256].numpy()
    onnx_logits = sess.run(None, {"image": sample})[0]
    torch_logits = model_cpu(xte[:256]).detach().numpy()
    max_diff = float(np.abs(onnx_logits - torch_logits).max())
    t_inf = time.time()
    for _ in range(5):
        sess.run(None, {"image": sample[:1]})
    cpu_ms_per_line = (time.time() - t_inf) / 5 * 1000

    results = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "device": str(device),
        "parameters": n_params,
        "epochs": args.epochs,
        "train_seconds": round(train_seconds, 1),
        "history": history,
        "best_val_accuracy": round(best_acc, 4),
        "seed_summary": seed_summary,
        "temperature": round(temperature, 4),
        "test_accuracy": round(float((pred == y).mean()), 4),
        "test_per_class": per_class(y, pred),
        "test_confusion": confusion(y, pred),
        "test_ece_raw": ece(probs_raw, yte),
        "test_ece_calibrated": ece(probs_cal, yte),
        "test_by_style": {k: {"n": len(v), "accuracy": round(float(np.mean(v)), 4)} for k, v in by_style.items()},
        "test_by_font": {k: {"n": len(v), "accuracy": round(float(np.mean(v)), 4)} for k, v in sorted(by_font.items())},
        "test_mixed_script_lines": {"n": sum(m["mixed"] for m in mte),
                                    "accuracy": round(float(np.mean([p == t for m, p, t in zip(mte, pred, y) if m["mixed"]] or [0])), 4)},
        "onnx_max_abs_logit_diff": max_diff,
        "onnx_cpu_ms_per_line": round(cpu_ms_per_line, 2),
        "class_balance_test": dict(Counter(CLASSES[i] for i in y)),
    }
    (OUT / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    meta = {"model_version": "script-id-" + datetime.now(timezone.utc).strftime("%Y%m%d"),
            "trained_at": results["trained_at"], "classes": CLASSES, "input": [1, INPUT_H, INPUT_W],
            "normalisation": "(gray/255 - 0.5) / 0.5, paper light / ink dark",
            "temperature": results["temperature"], "test_accuracy": results["test_accuracy"],
            "test_ece_calibrated": results["test_ece_calibrated"],
            "training_data": "Datasets/processed/script_id (rendered; see Datasets/README.md)"}
    (BACKEND_MODELS / "script_id.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    save_confusion_png(results["test_confusion"], OUT / "confusion_matrix.png")
    write_report(results)
    print(json.dumps({k: results[k] for k in ("best_val_accuracy", "test_accuracy", "temperature", "test_ece_raw",
                                               "test_ece_calibrated", "onnx_max_abs_logit_diff", "onnx_cpu_ms_per_line")}, indent=2))


def write_report(r: dict) -> None:
    lines = [
        "# Script identification (Sinhala / Tamil / Latin) - evaluation report", "",
        f"Trained {r['trained_at']} on {r['device']} ({r['train_seconds']} s wall-clock for the shipped seed, includes any machine sleep); {r['parameters']:,} parameters.", "",
        "Test lines use **fonts never seen in training** and **address text from the held-out corpus split**.", "",
        f"* Test accuracy of the shipped model: **{r['test_accuracy']:.4f}** (best validation accuracy {r['best_val_accuracy']:.4f}, "
        f"validation uses its own held-out fonts)",
        f"* Across {len(r['seed_summary']['seeds'])} training seeds: test accuracy {r['seed_summary']['test_accuracy_mean']:.4f} "
        f"± {r['seed_summary']['test_accuracy_sd']:.4f} (SD); handwriting-style lines {r['seed_summary']['handwriting_accuracy_mean']:.4f} "
        f"± {r['seed_summary']['handwriting_accuracy_sd']:.4f}. The shipped model is seed {r['seed_summary']['chosen_seed']}, chosen on "
        f"validation only.",
        f"* Temperature (fitted on validation): {r['temperature']}",
        f"* Expected calibration error on test: {r['test_ece_raw']} raw -> {r['test_ece_calibrated']} after temperature scaling",
        f"* ONNX export: max |logit difference| vs PyTorch = {r['onnx_max_abs_logit_diff']:.2e}; "
        f"{r['onnx_cpu_ms_per_line']} ms per line on CPU", "",
        "| Class | Precision | Recall | F1 | Support |", "|---|---|---|---|---|",
    ]
    for c, v in r["test_per_class"].items():
        lines.append(f"| {c} | {v['precision']:.4f} | {v['recall']:.4f} | {v['f1']:.4f} | {v['support']} |")
    lines += ["", "Confusion matrix (rows = true, columns = predicted; order si, ta, en):", ""]
    lines += ["    " + str(row) for row in r["test_confusion"]]
    lines += ["", "| Held-out font | n | Accuracy |", "|---|---|---|"]
    for f, v in r["test_by_font"].items():
        lines.append(f"| {f} | {v['n']} | {v['accuracy']:.4f} |")
    lines += ["", "| Style | n | Accuracy |", "|---|---|---|"]
    for s, v in r["test_by_style"].items():
        lines.append(f"| {s} | {v['n']} | {v['accuracy']:.4f} |")
    lines += [
        "", "![confusion matrix](confusion_matrix.png)", "",
        "## Limitations", "",
        "* Rendered lines, not photographs: real envelopes add camera blur, perspective and real handwriting.",
        "  No public Sinhala handwriting font was available, so Sinhala handwriting is not represented; measure it",
        "  on the consented envelope set (proposal section 3.3) before claiming handwriting performance.",
        "* The classifier only chooses the Tesseract language pack; the officer still reviews every field.",
    ]
    (OUT / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
