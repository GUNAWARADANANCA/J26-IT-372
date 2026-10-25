"""Time helpers. All stored timestamps are timezone-aware UTC."""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    SRI_LANKA = ZoneInfo("Asia/Colombo")
except ZoneInfoNotFoundError:  # Windows without the tzdata package
    from datetime import timedelta
    SRI_LANKA = timezone(timedelta(hours=5, minutes=30), "+0530")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso(value: str | datetime | None) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def local_str(dt: datetime | None, fmt: str = "%Y-%m-%d %H:%M") -> str:
    """Human-readable Sri Lanka time for receipts and messages."""
    return dt.astimezone(SRI_LANKA).strftime(fmt) if dt else ""
