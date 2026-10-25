"""PostAssist LK - Smart Registered Mail Intake and Tracking (J26-IT-372, IT23324138).

Run (from backend/):  .venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
API docs:             http://localhost:8000/docs
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import ensure_indexes, ensure_server, get_client
from .routers import admin, auth, devices, intake, iot, items, notifications, public, reports, review, scans
from .seed import seed
from .services.notifications.outbox import OutboxWorker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("postassist")
API_VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    ensure_server()   # starts the local MongoDB when it is not running yet
    ensure_indexes()
    if s.demo_seed:
        seed()
    worker = OutboxWorker(s) if s.outbox_worker_enabled else None
    if worker:
        worker.start()
    app.state.outbox_worker = worker
    yield
    if worker:
        worker.stop()
    get_client().close()


app = FastAPI(
    title="PostAssist LK - Smart Registered Mail Intake and Tracking",
    version=API_VERSION,
    description="Counter acceptance with assisted OCR and IoT weighing, versioned tariffs, barcode/QR labels, "
                "authenticated location-aware scans, offline sync and an outbox for sender notifications.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth, intake, items, scans, review, notifications, devices, iot, public, admin, reports):
    app.include_router(r.router)

@app.get("/api/health", tags=["meta"])
def health():
    get_client().admin.command("ping")
    return {"status": "ok", "api_version": API_VERSION, "component": "smart-registered-mail"}


# Postal KPI desk (employees, daily KPI, attendance, entitlements, payroll, productivity:
# backend/routes.py). Served by this app as well, so one server on port 8000 answers both web
# apps. Registered last (after every route above), so registered-mail paths always take precedence.
# It can still run on its own: `python main.py` in backend/.
try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from db import get_db as kpi_db  # noqa: E402
    from routes import router as kpi_router  # noqa: E402
except Exception as exc:  # noqa: BLE001 - registered mail must start even without the desk's packages
    log.warning("Postal KPI desk API not loaded (%s); install backend/requirements.txt to enable it", exc)
else:
    app.include_router(kpi_router, tags=["kpi desk"])

    @app.get("/health", tags=["kpi desk"])
    def kpi_health():
        return {"ok": True, "database": kpi_db().name}
