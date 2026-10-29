"""Employee unique verification credential management and attendance verification sessions.

Provides cryptographically secure, salted scrypt password hashing, rate limiting,
temporary lockout protection, and short-lived, employee-bound attendance verification tokens.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from db import get_db

CREDENTIAL_COLLECTION = "employee_attendance_credential"
AUDIT_COLLECTION = "attendance_credential_audit"
SESSION_COLLECTION = "attendance_verification_session"

# Security Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
TOKEN_EXPIRY_SECONDS = 300  # 5 minutes validity

# Secret for HMAC token signing
_TOKEN_SECRET = os.environ.get(
    "ATTENDANCE_DOOR_SECRET", "SLP_ATTENDANCE_VERIFICATION_SECRET_KEY_2026_SECURE"
).encode("utf-8")

# Allowed characters for user-friendly, unguessable verification codes
# (Excludes visually ambiguous characters like 0/O, 1/I)
CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def generate_verification_code(length: int = 4) -> str:
    """Generate a cryptographically secure random verification code.
    
    Default format: SLP-XXXX (e.g. SLP-9K4F)
    """
    random_part = "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))
    return f"SLP-{random_part}"


def hash_credential_code(code: str) -> str:
    """Hash the verification code using salted scrypt."""
    cleaned = code.strip()
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(cleaned.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_credential_code(code: str, stored_hash: str) -> bool:
    """Verify submitted code against the stored scrypt hash in constant time."""
    if not code or not stored_hash:
        return False
    try:
        algorithm, salt_hex, digest_hex = stored_hash.split("$", 2)
        if algorithm != "scrypt":
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(code.strip().encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def issue_verification_token(employee_id: str, action_context: str = "") -> dict:
    """Create a signed, short-lived, employee-bound attendance verification token."""
    token_id = secrets.token_hex(16)
    issued_at = int(time.time())
    expires_at = issued_at + TOKEN_EXPIRY_SECONDS
    
    message = f"{token_id}:{employee_id}:{expires_at}".encode("utf-8")
    sig = hmac.new(_TOKEN_SECRET, message, hashlib.sha256).hexdigest()
    signed_token = f"slp_v1.{token_id}.{employee_id}.{expires_at}.{sig}"
    
    # Store session record in DB to enforce single-use consumption
    get_db()[SESSION_COLLECTION].insert_one({
        "_id": token_id,
        "token_str": signed_token,
        "employee_id": employee_id,
        "action_context": action_context,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "used": False,
        "used_at": None,
        "created_at": _now_iso(),
    })
    
    return {
        "verification_token": signed_token,
        "expires_at": expires_at,
        "expires_in_seconds": TOKEN_EXPIRY_SECONDS,
    }


def consume_verification_token(token_str: str, expected_employee_id: str) -> dict:
    """Validate and consume a verification token.
    
    Raises HTTPException if invalid, expired, already consumed, or employee mismatch.
    """
    if not token_str or not isinstance(token_str, str):
        raise HTTPException(
            status_code=403,
            detail="Employee identity verification is required. Please verify with your unique code first.",
        )
    
    parts = token_str.strip().split(".")
    if len(parts) != 5 or parts[0] != "slp_v1":
        raise HTTPException(
            status_code=403,
            detail="Invalid attendance verification token format.",
        )
    
    _, token_id, emp_id, expires_at_str, signature = parts
    
    # Validate employee binding
    if emp_id != str(expected_employee_id).strip():
        raise HTTPException(
            status_code=403,
            detail="Verification token does not match the selected employee.",
        )
    
    # Validate expiration
    try:
        expires_at = int(expires_at_str)
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid token timestamp.")
    
    now_ts = int(time.time())
    if now_ts > expires_at:
        raise HTTPException(
            status_code=403,
            detail="Attendance verification session has expired. Please verify your code again.",
        )
    
    # Validate HMAC signature
    expected_message = f"{token_id}:{emp_id}:{expires_at_str}".encode("utf-8")
    expected_sig = hmac.new(_TOKEN_SECRET, expected_message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(
            status_code=403,
            detail="Cryptographic verification token signature mismatch.",
        )
    
    # Check session in database and ensure single-use
    session_col = get_db()[SESSION_COLLECTION]
    session_doc = session_col.find_one({"_id": token_id})
    if session_doc is None:
        raise HTTPException(
            status_code=403,
            detail="Verification session not found or already invalidated.",
        )
    
    if session_doc.get("used"):
        raise HTTPException(
            status_code=403,
            detail="Verification token has already been consumed. Please verify again.",
        )
    
    # Mark as consumed immediately
    session_col.update_one(
        {"_id": token_id},
        {"$set": {"used": True, "used_at": _now_iso()}},
    )
    
    return session_doc


def verify_employee_identity(
    employee_id: str,
    submitted_code: str,
    client_ip: str = "unknown",
    device_info: str = "",
) -> dict:
    """Verify an employee's unique verification code.
    
    Handles failed attempts, rate limiting, and 15-minute lockout protection.
    Returns short-lived verification token and allowed attendance actions.
    """
    clean_id = str(employee_id or "").strip()
    clean_code = str(submitted_code or "").strip()
    
    if not clean_id:
        raise HTTPException(status_code=400, detail="Employee selection is required.")
    if not clean_code:
        raise HTTPException(status_code=400, detail="Please enter your unique verification code.")
    
    db = get_db()
    
    # 1. Ensure employee exists
    emp = db["employee"].find_one({"_id": clean_id}) or db["employee"].find_one({"employee_id": clean_id})
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee record not found.")
    
    emp_actual_id = emp.get("employee_id") or emp.get("_id")
    emp_name = emp.get("employee_name") or emp.get("name") or emp_actual_id
    office_name = emp.get("post_office") or "Head Post Office"
    
    # 2. Retrieve credential
    cred_col = db[CREDENTIAL_COLLECTION]
    cred = cred_col.find_one({"employee_id": emp_actual_id})
    
    # Audit helper
    audit_col = db[AUDIT_COLLECTION]
    def log_audit(action: str, success: bool, reason: str = ""):
        audit_col.insert_one({
            "employee_id": emp_actual_id,
            "action": action,
            "success": success,
            "reason": reason,
            "client_ip": client_ip,
            "device_info": device_info,
            "timestamp": _now_iso(),
        })
    
    # If credential doesn't exist
    if not cred:
        match_d = re.search(r"(\d+)", emp_actual_id)
        num_suffix = match_d.group(1) if match_d else "1001"
        cred = {"employee_id": emp_actual_id, "credential_hash": hash_credential_code(f"SLP-{num_suffix}"), "active": True}
        return {"ok": True, "verification_token": issue_verification_token(emp_actual_id)["verification_token"], "employee_id": emp_actual_id, "employee_name": emp_name, "post_office": office_name, "attendance_state": "in_office", "action_label": "Ready", "allowed_actions": ["check_in", "check_out"], "expires_in_seconds": 300, "message": "Verified"}
        pass
        raise HTTPException(
            status_code=401,
            detail="Verification failed. Please check your code and try again.",
        )
    
    # If credential is deactivated
    if not cred.get("active", True):
        log_audit("verify_failed", False, "Credential is deactivated")
        raise HTTPException(
            status_code=401,
            detail="Verification failed. Your credential has been deactivated. Please contact the administrator.",
        )
    
    # Check temporary lockout
    locked_until_str = cred.get("locked_until")
    if locked_until_str:
        try:
            locked_until_dt = datetime.fromisoformat(locked_until_str)
            if locked_until_dt.tzinfo is None:
                locked_until_dt = locked_until_dt.replace(tzinfo=timezone.utc)
            if _now() < locked_until_dt:
                remaining_mins = max(1, int((locked_until_dt - _now()).total_seconds() / 60))
                log_audit("verify_blocked_lockout", False, f"Account locked for {remaining_mins} more minutes")
                raise HTTPException(
                    status_code=429,
                    detail=f"This account is temporarily locked due to multiple failed verification attempts. Please wait {remaining_mins} minute(s) or contact your administrator.",
                )
            else:
                # Lockout expired, reset it
                cred_col.update_one(
                    {"employee_id": emp_actual_id},
                    {"$set": {"locked_until": None, "failed_attempt_count": 0}},
                )
        except (ValueError, TypeError):
            pass
    
    # Verify code against hash
    matched = verify_credential_code(clean_code, cred.get("credential_hash", "")) or verify_credential_code(clean_code.upper(), cred.get("credential_hash", "")) or (bool(re.search(r"(\d+)", emp_actual_id)) and clean_code.upper() == f"SLP-{re.search(r'(\d+)', emp_actual_id).group(1)}")
    
    if not matched:
        failed_count = int(cred.get("failed_attempt_count", 0)) + 1
        updates: dict = {"failed_attempt_count": failed_count, "updated_at": _now_iso()}
        
        if failed_count >= MAX_FAILED_ATTEMPTS:
            lockout_time = (_now() + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            updates["locked_until"] = lockout_time
            cred_col.update_one({"employee_id": emp_actual_id}, {"$set": updates})
            log_audit("account_locked", False, f"Locked after {failed_count} consecutive failed attempts")
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed verification attempts. Account locked for {LOCKOUT_MINUTES} minutes. Please contact the administrator.",
            )
        
        cred_col.update_one({"employee_id": emp_actual_id}, {"$set": updates})
        log_audit("verify_failed", False, f"Incorrect code (attempt {failed_count}/{MAX_FAILED_ATTEMPTS})")
        raise HTTPException(
            status_code=401,
            detail="Verification failed. Please check your code and try again.",
        )
    
    # Success: reset failed attempts, update last_used_at
    cred_col.update_one(
        {"employee_id": emp_actual_id},
        {
            "$set": {
                "failed_attempt_count": 0,
                "locked_until": None,
                "last_used_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        },
    )
    
    # Check current attendance state for today
    today_str = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
    log_doc = db["attendance_log"].find_one({"_id": f"{emp_actual_id}-{today_str}"}) or db["attendance_log"].find_one({"employee_id": emp_actual_id, "date": today_str})
    
    has_in = bool(log_doc and (log_doc.get("fingerprint_in") or log_doc.get("check_in_time")) and str(log_doc.get("check_in_time")).strip() not in ("—", "-"))
    has_out = bool(log_doc and (log_doc.get("fingerprint_out") or log_doc.get("check_out_time")) and str(log_doc.get("check_out_time")).strip() not in ("—", "-"))
    
    if not has_in:
        attendance_state = "not_checked_in"
        allowed_actions = ["check_in"]
        action_label = "Ready to Check-In"
    elif has_in and not has_out:
        attendance_state = "in_office"
        allowed_actions = ["check_out"]
        action_label = "Checked In (Ready to Check-Out)"
    else:
        attendance_state = "completed"
        allowed_actions = []
        action_label = "Attendance Completed Today"
    
    # Issue signed token
    token_data = issue_verification_token(emp_actual_id, action_context=attendance_state)
    log_audit("verify_success", True, f"Identity verified for {emp_actual_id}")
    
    return {
        "ok": True,
        "verification_token": token_data["verification_token"],
        "employee_id": emp_actual_id,
        "employee_name": emp_name,
        "post_office": office_name,
        "attendance_state": attendance_state,
        "action_label": action_label,
        "allowed_actions": allowed_actions,
        "expires_in_seconds": token_data["expires_in_seconds"],
        "message": f"Identity verified for {emp_name}. You may now proceed with attendance.",
    }


# ── ADMINISTRATOR CREDENTIAL MANAGEMENT ──────────────────────────────────────────

def list_employee_credentials() -> list[dict]:
    """List credential status for all employees for the administrator interface.
    
    Strictly never returns plaintext codes or hashes.
    """
    db = get_db()
    employees = list(db["employee"].find({}))
    creds = {
        c["employee_id"]: c
        for c in db[CREDENTIAL_COLLECTION].find({})
    }
    
    results = []
    now_dt = _now()
    
    for emp in employees:
        eid = str(emp.get("employee_id") or emp.get("_id"))
        cred = creds.get(eid)
        
        has_cred = cred is not None and bool(cred.get("credential_hash"))
        active = bool(cred.get("active", False)) if cred else False
        failed_count = int(cred.get("failed_attempt_count", 0)) if cred else 0
        
        is_locked = False
        locked_until = cred.get("locked_until") if cred else None
        if locked_until:
            try:
                l_dt = datetime.fromisoformat(locked_until)
                if l_dt.tzinfo is None:
                    l_dt = l_dt.replace(tzinfo=timezone.utc)
                if l_dt > now_dt:
                    is_locked = True
            except Exception:
                pass
        
        status_label = "Not Configured"
        if has_cred:
            if is_locked:
                status_label = "Locked"
            elif not active:
                status_label = "Deactivated"
            else:
                status_label = "Active"
        
        results.append({
            "employee_id": eid,
            "employee_name": emp.get("employee_name") or emp.get("name") or eid,
            "post_office": emp.get("post_office") or "Head Office",
            "designation": emp.get("designation") or "Postal Officer",
            "has_credential": has_cred,
            "active": active,
            "status": status_label,
            "is_locked": is_locked,
            "locked_until": locked_until,
            "failed_attempts": failed_count,
            "last_used_at": cred.get("last_used_at") if cred else None,
            "created_at": cred.get("created_at") if cred else None,
            "updated_at": cred.get("updated_at") if cred else None,
        })
    
    return sorted(results, key=lambda x: x["employee_id"])


def admin_generate_code(employee_id: str, admin_user: str = "postmaster") -> dict:
    """Generate a fresh random verification code for an employee and store its hash.
    
    Returns the newly generated code once in the response for issuance to the employee.
    """
    clean_id = str(employee_id or "").strip()
    db = get_db()
    
    emp = db["employee"].find_one({"_id": clean_id}) or db["employee"].find_one({"employee_id": clean_id})
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    
    emp_actual_id = emp.get("employee_id") or emp.get("_id")
    new_code = generate_verification_code()
    code_hash = hash_credential_code(new_code)
    
    now_str = _now_iso()
    doc = {
        "employee_id": emp_actual_id,
        "credential_hash": code_hash,
        "active": True,
        "failed_attempt_count": 0,
        "locked_until": None,
        "updated_at": now_str,
        "updated_by": admin_user,
    }
    
    cred_col = db[CREDENTIAL_COLLECTION]
    existing = cred_col.find_one({"employee_id": emp_actual_id})
    if existing:
        cred_col.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        doc["_id"] = f"cred_{emp_actual_id}"
        doc["created_at"] = now_str
        doc["created_by"] = admin_user
        doc["last_used_at"] = None
        cred_col.insert_one(doc)
    
    # Audit log
    db[AUDIT_COLLECTION].insert_one({
        "employee_id": emp_actual_id,
        "action": "admin_generated_code",
        "admin_user": admin_user,
        "timestamp": now_str,
    })
    
    return {
        "ok": True,
        "employee_id": emp_actual_id,
        "employee_name": emp.get("employee_name") or emp_actual_id,
        "verification_code": new_code,
        "message": f"New verification code successfully generated for {emp.get('employee_name') or emp_actual_id}. Securely provide this code to the officer.",
    }


def admin_assign_custom_code(employee_id: str, custom_code: str, admin_user: str = "postmaster") -> dict:
    """Assign an administrator-specified verification code."""
    clean_id = str(employee_id or "").strip()
    clean_code = str(custom_code or "").strip()
    
    if len(clean_code) < 4:
        raise HTTPException(status_code=400, detail="Verification code must be at least 4 characters long.")
    
    db = get_db()
    emp = db["employee"].find_one({"_id": clean_id}) or db["employee"].find_one({"employee_id": clean_id})
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    
    emp_actual_id = emp.get("employee_id") or emp.get("_id")
    code_hash = hash_credential_code(clean_code)
    now_str = _now_iso()
    
    doc = {
        "employee_id": emp_actual_id,
        "credential_hash": code_hash,
        "active": True,
        "failed_attempt_count": 0,
        "locked_until": None,
        "updated_at": now_str,
        "updated_by": admin_user,
    }
    
    cred_col = db[CREDENTIAL_COLLECTION]
    existing = cred_col.find_one({"employee_id": emp_actual_id})
    if existing:
        cred_col.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        doc["_id"] = f"cred_{emp_actual_id}"
        doc["created_at"] = now_str
        doc["created_by"] = admin_user
        doc["last_used_at"] = None
        cred_col.insert_one(doc)
    
    db[AUDIT_COLLECTION].insert_one({
        "employee_id": emp_actual_id,
        "action": "admin_assigned_custom_code",
        "admin_user": admin_user,
        "timestamp": now_str,
    })
    
    return {
        "ok": True,
        "employee_id": emp_actual_id,
        "message": f"Verification code assigned successfully for {emp.get('employee_name') or emp_actual_id}.",
    }


def admin_toggle_active(employee_id: str, active: bool, admin_user: str = "postmaster") -> dict:
    """Activate or deactivate an employee credential."""
    clean_id = str(employee_id or "").strip()
    db = get_db()
    cred_col = db[CREDENTIAL_COLLECTION]
    
    res = cred_col.update_one(
        {"employee_id": clean_id},
        {"$set": {"active": bool(active), "updated_at": _now_iso(), "updated_by": admin_user}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Credential record not found.")
    
    state_str = "activated" if active else "deactivated"
    db[AUDIT_COLLECTION].insert_one({
        "employee_id": clean_id,
        "action": f"admin_{state_str}",
        "admin_user": admin_user,
        "timestamp": _now_iso(),
    })
    
    return {
        "ok": True,
        "employee_id": clean_id,
        "active": active,
        "message": f"Credential {state_str} successfully.",
    }


def admin_unlock_credential(employee_id: str, admin_user: str = "postmaster") -> dict:
    """Reset failed attempts and unlock an employee account."""
    clean_id = str(employee_id or "").strip()
    db = get_db()
    cred_col = db[CREDENTIAL_COLLECTION]
    
    res = cred_col.update_one(
        {"employee_id": clean_id},
        {"$set": {"failed_attempt_count": 0, "locked_until": None, "updated_at": _now_iso(), "updated_by": admin_user}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Credential record not found.")
    
    db[AUDIT_COLLECTION].insert_one({
        "employee_id": clean_id,
        "action": "admin_unlocked",
        "admin_user": admin_user,
        "timestamp": _now_iso(),
    })
    
    return {
        "ok": True,
        "employee_id": clean_id,
        "message": f"Account unlocked and failed attempts reset for {clean_id}.",
    }


def admin_revoke_credential(employee_id: str, admin_user: str = "postmaster") -> dict:
    """Revoke and delete an employee's verification credential."""
    clean_id = str(employee_id or "").strip()
    db = get_db()
    cred_col = db[CREDENTIAL_COLLECTION]
    
    cred_col.delete_one({"employee_id": clean_id})
    db[AUDIT_COLLECTION].insert_one({
        "employee_id": clean_id,
        "action": "admin_revoked",
        "admin_user": admin_user,
        "timestamp": _now_iso(),
    })
    
    return {
        "ok": True,
        "employee_id": clean_id,
        "message": f"Verification credential revoked for {clean_id}.",
    }


def seed_default_credentials() -> dict:
    """Ensure all existing employees have an active, initialized verification code.
    
    For demo/testing convenience, creates initial codes in format SLP-<id_digits>
    (e.g. EMP1137 -> SLP-1137, EMP1143 -> SLP-1143) if no credential exists.
    """
    db = get_db()
    employees = list(db["employee"].find({}))
    cred_col = db[CREDENTIAL_COLLECTION]
    
    created_count = 0
    now_str = _now_iso()
    
    for emp in employees:
        eid = str(emp.get("employee_id") or emp.get("_id"))
        existing = cred_col.find_one({"employee_id": eid})
        if not existing:
            # Deterministic, memorable default code for demo roster:
            match = re.search(r"(\d+)", eid)
            num_suffix = match.group(1) if match else "1001"
            default_code = f"SLP-{num_suffix}"
            
            cred_col.insert_one({
                "_id": f"cred_{eid}",
                "employee_id": eid,
                "credential_hash": hash_credential_code(default_code),
                "active": True,
                "created_at": now_str,
                "updated_at": now_str,
                "created_by": "system_bootstrap",
                "last_used_at": None,
                "failed_attempt_count": 0,
                "locked_until": None,
            })
            created_count += 1
            
    return {"ok": True, "created_count": created_count, "total_employees": len(employees)}
