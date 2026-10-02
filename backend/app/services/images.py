"""Storage of envelope images (local disk; the path is kept in the ``images`` collection).

Images may contain personal data: the storage folder is git-ignored, access
is restricted to staff of the same office, and real customer envelopes must
not be photographed without the approvals described in the proposal (3.2).
"""
from __future__ import annotations

import secrets

from ..config import get_settings
from ..db import get_db
from ..timeutil import utcnow
from .ocr.pipeline import decode_image
from .ocr.quality import assess_quality


def store_image(data: bytes, *, office_id: str, draft_id: str | None, source: str, actor: str) -> dict:
    img = decode_image(data)  # raises ValueError for non-images
    s = get_settings()
    image_id = "IMG-" + secrets.token_hex(6).upper()
    folder = s.storage_dir / "images"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{image_id}.jpg"
    path.write_bytes(data)
    now = utcnow()
    doc = {"_id": image_id, "draft_id": draft_id, "office_id": office_id, "source": source, "path": str(path),
           "bytes": len(data), "width": int(img.shape[1]), "height": int(img.shape[0]),
           "quality": assess_quality(img), "created_at": now, "created_by": actor}
    db = get_db()
    db.images.insert_one(doc)
    if draft_id:
        draft = db.drafts.find_one({"_id": draft_id}, {"timings": 1})
        sets = {"current_image_id": image_id, "updated_at": now}
        if not (draft or {}).get("timings", {}).get("first_image_at"):
            sets["timings.first_image_at"] = now
        db.drafts.update_one({"_id": draft_id}, {"$push": {"images": image_id}, "$set": sets})
    return doc
