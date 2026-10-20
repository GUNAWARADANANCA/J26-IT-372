"""PostAssist API. The MongoDB client lives in db.py."""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import AutoReconnect, InvalidOperation, NetworkTimeout, ServerSelectionTimeoutError

load_dotenv()

from auth import bootstrap_clerk, bootstrap_postmaster  # noqa: E402
from attendance_credential import seed_default_credentials  # noqa: E402
from daily_accounts import init_daily_accounts_indexes  # noqa: E402
from db import connect, disconnect, get_db, init_performance_indexes, reset_client  # noqa: E402
from routes import router  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        connect()
        bootstrap_postmaster()
        bootstrap_clerk()
        init_performance_indexes()
        init_daily_accounts_indexes()
        seed_default_credentials()
    except Exception as exc:
        disconnect()
        print(f"MongoDB was not reachable at startup: {exc}", flush=True)
        print("The API will keep running and retry on the next request.", flush=True)
    yield
    disconnect()


_extra_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("PUBLIC_APP_URL", "").split(",")
    if origin.strip()
]
app = FastAPI(title="PostAssist", lifespan=lifespan)
app.include_router(router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://localhost:5174",
        "https://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        *_extra_origins,
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ServerSelectionTimeoutError)
@app.exception_handler(AutoReconnect)
@app.exception_handler(NetworkTimeout)
@app.exception_handler(InvalidOperation)
async def database_unavailable(_request: Request, _exc: Exception):
    reset_client()
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is temporarily unreachable."},
    )


@app.get("/")
def root():
    return {"ok": True, "health": "/health", "docs": "/docs"}


@app.get("/health")
def health():
    db_ok = False
    db_name = "postassist"
    try:
        db = get_db()
        db_ok = True
        db_name = db.name
    except Exception as exc:
        db_ok = False
        db_name = f"reconnecting ({exc})"
    return {"ok": True, "service": "PostAssist", "database": db_name, "db_connected": db_ok}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
