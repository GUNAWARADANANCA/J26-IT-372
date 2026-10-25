"""Application settings, read from environment variables (and backend/.env if present)."""
from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
log = logging.getLogger(__name__)


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines); real environment variables win."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def _list(name: str, default: str) -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


@dataclass
class Settings:
    mongodb_uri: str
    mongodb_db: str
    jwt_secret: str
    jwt_expire_minutes: int
    cors_origins: list[str]
    storage_dir: Path
    public_base_url: str
    tracking_prefix: str

    # OCR / address processing
    tesseract_cmd: str
    llm_provider: str
    ollama_url: str
    ollama_model: str

    # Weighing (proposal section 3.9)
    weight_min_g: float
    weight_max_g: float
    reading_max_age_s: float
    default_uncertainty_g: float
    device_offline_after_s: float

    # Notifications (proposal section 3.11)
    email_adapter: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_from: str
    resend_api_key: str
    resend_from: str
    outbox_worker_enabled: bool
    outbox_poll_seconds: float
    outbox_max_attempts: int
    outbox_fault_mode: str

    # Demo data
    demo_seed: bool
    demo_password: str
    seed_device_id: str
    seed_device_key: str

    # Local development: start this computer's MongoDB when the API starts and finds none.
    mongodb_autostart: bool = True
    mongod_path: Path = Path.home() / "PostAssist" / "mongodb" / "bin" / "mongod.exe"
    mongod_dbpath: Path = Path.home() / "PostAssist" / "mongo-data"

    extras: dict = field(default_factory=dict)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_dotenv(BACKEND_ROOT / ".env")
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        secret = secrets.token_urlsafe(48)
        log.warning("JWT_SECRET is not set; using a random secret (sessions end when the server restarts)")
    storage = Path(os.environ.get("STORAGE_DIR", BACKEND_ROOT / "storage"))
    storage.mkdir(parents=True, exist_ok=True)
    return Settings(
        mongodb_uri=os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017"),
        mongodb_db=os.environ.get("MONGODB_DB", "postassist_registered_mail"),
        jwt_secret=secret,
        jwt_expire_minutes=int(os.environ.get("JWT_EXPIRE_MINUTES", 720)),
        cors_origins=_list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
        storage_dir=storage,
        public_base_url=os.environ.get("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/"),
        tracking_prefix=os.environ.get("TRACKING_PREFIX", "PA-DEMO"),
        tesseract_cmd=os.environ.get("TESSERACT_CMD", ""),
        llm_provider=os.environ.get("LLM_PROVIDER", "none").lower(),
        ollama_url=os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434"),
        ollama_model=os.environ.get("OLLAMA_MODEL", "gemma3:4b"),
        weight_min_g=_float("WEIGHT_MIN_G", 5),
        weight_max_g=_float("WEIGHT_MAX_G", 500),
        reading_max_age_s=_float("READING_MAX_AGE_S", 3),
        default_uncertainty_g=_float("DEFAULT_WEIGHT_UNCERTAINTY_G", 2.0),
        device_offline_after_s=_float("DEVICE_OFFLINE_AFTER_S", 10),
        email_adapter=os.environ.get("NOTIFY_EMAIL_ADAPTER", "file").lower(),
        smtp_host=os.environ.get("SMTP_HOST", ""),
        smtp_port=int(os.environ.get("SMTP_PORT", 587)),
        smtp_user=os.environ.get("SMTP_USER", ""),
        smtp_password=os.environ.get("SMTP_PASSWORD", ""),
        smtp_from=os.environ.get("SMTP_FROM", "PostAssist LK <no-reply@example.test>"),
        resend_api_key=os.environ.get("RESEND_API_KEY", ""),
        resend_from=os.environ.get("RESEND_FROM", ""),
        outbox_worker_enabled=_bool("OUTBOX_WORKER_ENABLED", True),
        outbox_poll_seconds=_float("OUTBOX_POLL_SECONDS", 2),
        outbox_max_attempts=int(os.environ.get("OUTBOX_MAX_ATTEMPTS", 6)),
        outbox_fault_mode=os.environ.get("OUTBOX_FAULT_MODE", "none").lower(),
        demo_seed=_bool("DEMO_SEED", True),
        demo_password=os.environ.get("DEMO_PASSWORD", "PostAssist#2026"),
        seed_device_id=os.environ.get("SEED_DEVICE_ID", "SCALECAM-01"),
        seed_device_key=os.environ.get("SEED_DEVICE_KEY", ""),
        mongodb_autostart=_bool("MONGODB_AUTOSTART", True),
        mongod_path=Path(os.environ.get("MONGOD_PATH", Path.home() / "PostAssist" / "mongodb" / "bin" / "mongod.exe")),
        mongod_dbpath=Path(os.environ.get("MONGOD_DBPATH", Path.home() / "PostAssist" / "mongo-data")),
    )
