"""Append-only audit log (who did what to which record, and why).

Audit entries deliberately store identifiers and reasons, not personal data
such as names or addresses (NFR06).
"""
from __future__ import annotations

import logging

from .db import get_db
from .timeutil import utcnow

log = logging.getLogger("audit")


def audit(actor: str, action: str, target: str, details: dict | None = None, *, severity: str = "info") -> None:
    entry = {"at": utcnow(), "actor": actor, "action": action, "target": target,
             "details": details or {}, "severity": severity}
    try:
        get_db().audit_log.insert_one(entry)
    except Exception:  # noqa: BLE001 - auditing must never break the request path
        log.exception("could not write audit entry %s %s", action, target)
    if severity == "security":
        log.warning("security event %s by %s on %s", action, actor, target)
