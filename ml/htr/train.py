"""Train the handwriting recogniser (CRNN + CTC) and export it to ONNX.

    ml/.venv/Scripts/python ml/htr/build_cache.py     # once
    ml/.venv/Scripts/python ml/htr/train.py
    ml/.venv/Scripts/python ml/htr/evaluate.py        # report: test sets, Tesseract baseline

* Model: 7 conv layers -> 2 x bidirectional LSTM -> linear, about 4.6 M parameters. The line image is
  48 px high and as wide as the writing; one output frame per 4 px, decoded with CTC.
  One network reads Sinhala, English and Tamil, so mixed lines ("No. 230, සිංහපුර") need no switching.
* Data: see data.py. Each epoch mixes every real training line with freshly drawn synthetic lines.
* Selection: lowest mean character error rate over the validation sets (real Sinhala, real English,
  Tamil in a validation font). The test sets are only read after training.

Artefacts:
  backend/models/htr.onnx, backend/models/htr.meta.json
  ml/reports/htr/metrics.json, training_log.txt
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_MODELS, REPORTS, ensure  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data import CACHE, Chunker, FixedLines, TrainLines  # noqa: E402

OUT = REPORTS / "htr"
PLAN = {"sinocr_repeat": 4, "si_comp": 6000, "si_font": 600, "en_font": 2000, "ta_font": 2000}


class HtrNet(nn.Module):
    def __init__(self, n_classes: int, hidden: int = 256):
        super().__init__()

        def block(cin, cout):
            return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True))

        self.features = nn.Sequential(
            block(1, 48), nn.MaxPool2d(2),                           # 24 x W/2
            block(48, 96), nn.MaxPool2d(2),                          # 12 x W/4
            block(96, 160), block(160, 160), nn.MaxPool2d((2, 1)),   # 6
            block(160, 256), block(256, 256), nn.MaxPool2d((2, 1)),  # 3
            nn.Conv2d(256, 320, (3, 1), bias=False), nn.BatchNorm2d(320), nn.ReLU(inplace=True),  # 1 x W/4
        )
        self.drop = nn.Dropout(0.2)
        self.rnn = nn.LSTM(320, hidden, num_layers=2, bidirectional=True, batch_first=True, dropout=0.25)
        self.head = nn.Linear(2 * hidden, n_classes)

    def forward(self, image, frames=None):
        x = self.drop(self.features(image).squeeze(2).transpose(1, 2))   # batch, frames, 320
        if frames is None:
            x, _ = self.rnn(x)
        else:   # padded batch: stop each line at its own end, as when it is read alone
            packed = pack_padded_sequence(x, frames.cpu(), batch_first=True, enforce_sorted=False)
            x, _ = pad_packed_sequence(self.rnn(packed)[0], batch_first=True, total_length=x.shape[1])
        return self.head(x)


def edit_distance(a, b) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def greedy(logits: torch.Tensor, frames: torch.Tensor, charset: list[str]) -> list[str]:
    best = logits.argmax(dim=2).cpu().numpy()
    out = []
    for row, n in zip(best, frames.tolist()):
        chars, prev = [], 0
        for idx in row[:n]:
            if idx != 0 and idx != prev:
                chars.append(charset[idx])
            prev = idx
        out.append("".join(chars))
    return out


@torch.no_grad()
def evaluate(model, dataset, charset, device, batch_size: int = 48) -> dict:
    """Character and word error rate per source, plus a few examples."""
    model.eval()
    loader = torch.utils.data.DataLoader(dataset, batch_size=batch_size * 4, collate_fn=Chunker(batch_size))
    stats, examples = defaultdict(lambda: [0, 0, 0, 0, 0]), defaultdict(list)
    for chunk in loader:
        for images, frames, _, _, texts, sources in chunk:
            with torch.autocast(device.type, enabled=device.type == "cuda"):
                logits = model(images.to(device), frames)
            for ref, hyp, source in zip(texts, greedy(logits.float(), frames, charset), sources):
                s = stats[source]
                s[0] += edit_distance(ref, hyp)
                s[1] += len(ref)
                s[2] += edit_distance(ref.split(), hyp.split())
                s[3] += len(ref.split())
                s[4] += 1
                if len(examples[source]) < 6:
                    examples[source].append({"truth": ref, "read": hyp})
    return {source: {"cer": round(s[0] / max(s[1], 1), 4), "wer": round(s[2] / max(s[3], 1), 4), "lines": s[4],
                     "examples": examples[source]} for source, s in stats.items()}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--epochs", type=int, default=40, help="0 = only test and export the best saved checkpoint")
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1.5e-3)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--scale", type=float, default=1.0, help="fraction of the synthetic lines per epoch (smoke tests)")
    ap.add_argument("--seed", type=int, default=372)
    args = ap.parse_args()
    ensure(OUT, BACKEND_MODELS)
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cuda":   # stay inside the card's own memory: spilling into shared memory is several times slower
        torch.cuda.set_per_process_memory_fraction(0.85)

    charset = json.loads((CACHE / "charset.json").read_text(encoding="utf-8"))
    plan = {k: v if k == "sinocr_repeat" else int(v * args.scale) for k, v in PLAN.items()}
    train = TrainLines(charset, plan)
    loader = torch.utils.data.DataLoader(train, batch_size=args.batch * 8, shuffle=True, num_workers=args.workers,
                                         collate_fn=Chunker(args.batch), persistent_workers=args.workers > 0)
    val_sets = {"sinocr": FixedLines.real(charset, "val", "sinocr"), "iam": FixedLines.real(charset, "val", "iam"),
                "ta_font": FixedLines.font(charset, "val", "ta", 300)}

    model = HtrNet(len(charset)).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scaler = torch.amp.GradScaler(enabled=device.type == "cuda")
    total_steps = max(1, args.epochs * math.ceil(len(train) / args.batch))
    warmup = max(1, min(600, total_steps // 10))
    log_path = OUT / "training_log.txt"
    log_path.write_text("", encoding="utf-8")

    def say(text: str) -> None:
        print(text, flush=True)
        with log_path.open("a", encoding="utf-8") as f:
            f.write(text + "\n")

    say(f"device {device}, {n_params / 1e6:.2f} M parameters, {len(charset) - 1} characters, "
        f"{len(train)} lines per epoch, plan {plan}")
    step, best, history, started = 0, (9.0, -1), [], time.time()
    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, losses = time.time(), []
        for chunk in loader:
            for images, frames, targets, target_lengths, _, _ in chunk:
                step += 1
                progress = min(step / total_steps, 1.0)
                lr = args.lr * (step / warmup if step < warmup else 0.5 * (1 + math.cos(math.pi * progress)) * 0.98 + 0.02)
                for group in optimizer.param_groups:
                    group["lr"] = lr
                with torch.autocast(device.type, enabled=device.type == "cuda"):
                    logits = model(images.to(device, non_blocking=True), frames)
                log_probs = F.log_softmax(logits.float(), dim=2).transpose(0, 1)
                loss = F.ctc_loss(log_probs, targets, frames, target_lengths, zero_infinity=True)
                optimizer.zero_grad(set_to_none=True)
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                nn.utils.clip_grad_norm_(model.parameters(), 5.0)
                scaler.step(optimizer)
                scaler.update()
                losses.append(loss.item())
        val = {name: evaluate(model, ds, charset, device)[name] for name, ds in val_sets.items()}
        score = float(np.mean([v["cer"] for v in val.values()]))
        history.append({"epoch": epoch, "loss": round(float(np.mean(losses)), 4), "val_cer": {k: v["cer"] for k, v in val.items()},
                        "score": round(score, 4), "seconds": round(time.time() - t0)})
        if score < best[0]:
            best = (score, epoch)
            torch.save(model.state_dict(), CACHE / "htr_best.pt")
        say(f"epoch {epoch:3d}  loss {history[-1]['loss']:.3f}  val CER  si {val['sinocr']['cer']:.3f}  en {val['iam']['cer']:.3f}  "
            f"ta(font) {val['ta_font']['cer']:.3f}  mean {score:.4f}{' *' if best[1] == epoch else ''}  {history[-1]['seconds']} s")

    # ---- held-out test sets, best checkpoint -------------------------------------------
    model.load_state_dict(torch.load(CACHE / "htr_best.pt", map_location=device))
    tests = {"sinocr": FixedLines.real(charset, "test", "sinocr"), "iam": FixedLines.real(charset, "test", "iam"),
             "ta_font": FixedLines.font(charset, "test", "ta", 500), "en_font": FixedLines.font(charset, "test", "en", 400)}
    test = {}
    for name, ds in tests.items():
        test.update(evaluate(model, ds, charset, device))
    for name, r in test.items():
        say(f"test {name:8s} CER {r['cer']:.4f}  WER {r['wer']:.4f}  ({r['lines']} lines)")

    # ---- ONNX export + parity check -----------------------------------------------------
    onnx_path = BACKEND_MODELS / "htr.onnx"
    cpu_model = model.to("cpu").eval()
    sample = tests["sinocr"][0][0][None]
    torch.onnx.export(cpu_model, sample, str(onnx_path), input_names=["image"], output_names=["logits"],
                      dynamic_axes={"image": {0: "batch", 3: "width"}, "logits": {0: "batch", 1: "frames"}},
                      opset_version=17, dynamo=False)
    import onnxruntime as ort
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    max_diff, t0 = 0.0, time.time()
    probes = [tests[name][i][0][None] for name in tests for i in range(8)]
    for probe in probes:
        with torch.no_grad():
            max_diff = max(max_diff, float(np.abs(session.run(None, {"image": probe.numpy()})[0] - cpu_model(probe).numpy()).max()))
    t0 = time.time()
    for probe in probes:
        session.run(None, {"image": probe.numpy()})
    ms_per_line = (time.time() - t0) * 1000 / len(probes)
    say(f"ONNX: max |logit difference| {max_diff:.2e}, {ms_per_line:.1f} ms per line on CPU, {onnx_path.stat().st_size / 1e6:.1f} MB")

    meta = {
        "charset": charset, "line_height": 48, "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "architecture": "CRNN: 7 conv -> 2 x BiLSTM(256) -> linear, CTC", "parameters": n_params,
        "best_epoch": best[1], "epochs": args.epochs, "plan": plan,
        "training_data": {"sinhala": "SinOCR handwritten (real lines) + composites of the 454-class handwritten character set + fonts",
                          "english": "IAM lines (real) + handwriting-style fonts with address text",
                          "tamil": "fonts only - no real Tamil handwriting was used"},
        "test": {name: {k: r[k] for k in ("cer", "wer", "lines")} for name, r in test.items()},
    }
    (BACKEND_MODELS / "htr.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "metrics.json").write_text(json.dumps({
        "history": history, "best_epoch": best[1], "best_val_score": round(best[0], 4), "test": test,
        "onnx_max_abs_logit_diff": max_diff, "onnx_cpu_ms_per_line": round(ms_per_line, 1),
        "train_minutes": round((time.time() - started) / 60, 1), "parameters": n_params, "plan": plan,
        "seed": args.seed, "torch": torch.__version__, "device": str(device)}, ensure_ascii=False, indent=1), encoding="utf-8")
    say(f"done in {(time.time() - started) / 60:.1f} min; best epoch {best[1]}")


if __name__ == "__main__":
    main()
