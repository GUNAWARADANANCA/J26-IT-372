"""Administration: offices and reference zones, tariffs, location policy, users."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..audit import audit
from ..db import get_db
from ..schemas import OfficeUpdate, PolicyModeIn, ReasonIn, UserCreateIn
from ..security import get_current_user, hash_password, public_user, require_roles
from ..services.scan_events import active_policy
from ..timeutil import utcnow
from .common import get_or_404, problem, same_office

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin = require_roles()
postmaster = require_roles("postmaster")


@router.get("/offices")
def offices(user: dict = Depends(get_current_user)):
    return list(get_db().offices.find().sort("name", 1))


@router.patch("/offices/{office_id}")
def update_office(office_id: str, body: OfficeUpdate, user: dict = Depends(postmaster)):
    """Set an office's reference point and zone radii, with a mandatory provenance note
    (e.g. 'measured on site 2026-11-02 with phone, accuracy 6 m')."""
    get_or_404("offices", office_id, "office")
    same_office(user, office_id)
    sets = {k: v for k, v in body.model_dump().items() if v is not None}
    sets.update(updated_at=utcnow(), updated_by=user["username"])
    get_db().offices.update_one({"_id": office_id}, {"$set": sets})
    audit(user["username"], "office.updated", office_id, sets)
    return get_db().offices.find_one({"_id": office_id})


@router.get("/tariffs")
def tariffs(user: dict = Depends(get_current_user)):
    return list(get_db().tariffs.find({}, {"_id": 0}).sort("effective_from", -1))


@router.post("/tariffs/{version}/approve")
def approve_tariff(version: str, body: ReasonIn, user: dict = Depends(admin)):
    res = get_db().tariffs.update_one({"tariff_version": version}, {"$set": {
        "approval_status": "approved", "approved_by": user["username"], "approved_at": utcnow(), "approval_note": body.reason}})
    if not res.matched_count:
        raise problem("NOT_FOUND", "tariff not found", 404)
    audit(user["username"], "tariff.approved", version, {"reason": body.reason}, severity="warning")
    return {"ok": True}


@router.get("/policy")
def policy(user: dict = Depends(get_current_user)):
    p = active_policy(get_db())
    p.pop("_id", None)
    return p


@router.post("/policy/mode")
def set_policy_mode(body: PolicyModeIn, user: dict = Depends(admin)):
    """Switch between L0 / L1 / L2 for the location experiment. Each switch creates a new
    policy version so every event records exactly which policy decided it."""
    db = get_db()
    current = active_policy(db)
    current.pop("_id", None)
    now = utcnow()
    new = {**current, "mode": body.mode, "policy_version": f"LOC-{now:%Y%m%d%H%M%S}-{body.mode}",
           "active": True, "activated_at": now, "activated_by": user["username"], "reason": body.reason}
    db.location_policies.update_many({"active": True}, {"$set": {"active": False}})
    db.location_policies.insert_one(new)
    audit(user["username"], "policy.mode_changed", new["policy_version"], {"mode": body.mode, "reason": body.reason},
          severity="warning")
    new.pop("_id", None)
    return new


@router.get("/users")
def users(user: dict = Depends(postmaster)):
    q = {} if user["role"] == "admin" else {"office_id": user.get("office_id")}
    return [public_user(u) for u in get_db().users.find(q)]


@router.post("/users")
def create_user(body: UserCreateIn, user: dict = Depends(admin)):
    if get_db().users.find_one({"username": body.username}):
        raise problem("EXISTS", "username already exists")
    get_or_404("offices", body.office_id, "office")
    doc = {**body.model_dump(exclude={"password"}), "password_hash": hash_password(body.password), "active": True,
           "created_at": utcnow()}
    get_db().users.insert_one(doc)
    audit(user["username"], "user.created", body.username, {"role": body.role, "office": body.office_id})
    return public_user(doc)
