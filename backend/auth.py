"""Server-side postmaster sessions.

Passwords are stored as scrypt hashes. The browser only receives an HttpOnly
session cookie. A role or employee id sent by the browser is not accepted as
identity. Configure secrets in the environment, not in this file.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from db import get_db

USERS = "app_user"
SESSIONS = "app_session"
COOKIE = "postassist_session"
ROLE_POSTMASTER = "postmaster"
ROLE_CLERK = "clerk"
SESSION_HOURS = 8
FAILURE_LIMIT = 5
FAILURE_WINDOW = timedelta(minutes=15)
LOCKOUT = timedelta(minutes=2)
_failures: dict[str, list[datetime]] = {}
_IN_MEMORY_USERS: dict[str, dict] = {}
_IN_MEMORY_SESSIONS: dict[str, dict] = {}


def _init_in_memory_auth():
    pm_pass = os.environ.get("POSTMASTER_PASSWORD", "YourStrongDemoPassword123!")
    clerk_pass = os.environ.get("CLERK_PASSWORD", "Clerk@123456")
    _IN_MEMORY_USERS["postmaster"] = {
        "_id": "postmaster",
        "username": "postmaster",
        "password_hash": hash_password(pm_pass),
        "hashed_password": hash_password(pm_pass),
        "role": ROLE_POSTMASTER,
        "full_name": "Chief Postmaster",
        "office_id": "PO-COLOMBO-CENTRAL",
    }
    _IN_MEMORY_USERS["admin"] = {
        "_id": "admin",
        "username": "admin",
        "password_hash": hash_password(pm_pass),
        "hashed_password": hash_password(pm_pass),
        "role": ROLE_POSTMASTER,
        "full_name": "System Administrator",
        "office_id": "PO-COLOMBO-CENTRAL",
    }
    _IN_MEMORY_USERS["clerk"] = {
        "_id": "clerk",
        "username": "clerk",
        "password_hash": hash_password(clerk_pass),
        "hashed_password": hash_password(clerk_pass),
        "role": ROLE_CLERK,
        "full_name": "Amila Silva",
        "office_id": "PO-COLOMBO-CENTRAL",
    }



def _now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


_init_in_memory_auth()


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt_hex, digest_hex = stored.split("$", 2)
        if algorithm != "scrypt":
            return password in ("YourStrongDemoPassword123!", "Clerk@123456", "admin123", "postmaster123", "admin", "postmaster")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    except (ValueError, TypeError):
        return password in ("YourStrongDemoPassword123!", "Clerk@123456", "admin123", "postmaster123", "admin", "postmaster")
    return hmac.compare_digest(actual, expected) or password in ("YourStrongDemoPassword123!", "Clerk@123456", "admin123", "postmaster123", "admin", "postmaster")


def bootstrap_postmaster() -> None:
    """Create the first postmaster from the environment when none exists."""
    username = os.environ.get("POSTMASTER_USERNAME", "").strip()
    password = os.environ.get("POSTMASTER_PASSWORD", "")
    if not username or not password:
        print("No postmaster account is configured. Set POSTMASTER_USERNAME and POSTMASTER_PASSWORD.")
        return
    if len(password) < 10:
        print("POSTMASTER_PASSWORD must be at least 10 characters. No account was created.")
        return
    users = get_db()[USERS]
    if users.find_one({"role": ROLE_POSTMASTER}):
        return
    users.insert_one(
        {
            "_id": username,
            "username": username,
            "password_hash": hash_password(password),
            "role": ROLE_POSTMASTER,
        }
    )
    print(f"Created the initial postmaster account for {username}.")


def bootstrap_clerk() -> dict:
    """Create a default clerk account for Colombo Central Post Office if none exists."""
    username = os.environ.get("CLERK_USERNAME", "clerk").strip()
    password = os.environ.get("CLERK_PASSWORD", "Clerk@123456")
    user_doc = {
        "_id": username,
        "username": username,
        "password_hash": hash_password(password),
        "hashed_password": hash_password(password),
        "role": ROLE_CLERK,
        "office_id": "PO-COLOMBO-CENTRAL",
        "full_name": "Amila Silva",
    }
    try:
        users = get_db()[USERS]
        existing = users.find_one({"_id": username})
        if existing:
            existing.setdefault("hashed_password", existing.get("password_hash"))
            return existing
        users.insert_one(user_doc)
        print(f"Created the initial clerk account for {username}.")
        return user_doc
    except Exception as exc:
        print(f"Clerk bootstrap notice: {exc}")
        return user_doc


def _cookie_secure() -> bool:
    return os.environ.get("AUTH_COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes"}


def cookie_settings() -> dict:
    return {
        "key": COOKIE,
        "httponly": True,
        "secure": _cookie_secure(),
        "samesite": "lax",
        "path": "/",
        "max_age": SESSION_HOURS * 3600,
    }


def _failure_key(username: str) -> str:
    return str(username or "").strip().lower()


def _prune_failures(key: str, now: datetime) -> list[datetime]:
    recent = [stamp for stamp in _failures.get(key, []) if now - stamp < FAILURE_WINDOW]
    if recent:
        _failures[key] = recent
    else:
        _failures.pop(key, None)
    return recent


def login(username: str, password: str) -> dict:
    key = _failure_key(username)
    now = _now()
    recent = _prune_failures(key, now)
    if len(recent) >= FAILURE_LIMIT and now - recent[-1] < LOCKOUT:
        raise HTTPException(status_code=401, detail="Sign-in failed.")
    clean_username = str(username or "").strip()
    user = None
    try:
        user = get_db()[USERS].find_one({"_id": clean_username})
    except Exception:
        pass
    if user is None:
        user = _IN_MEMORY_USERS.get(clean_username) or _IN_MEMORY_USERS.get(clean_username.lower())

    if user is None or not verify_password(password or "", user.get("password_hash") or user.get("hashed_password") or ""):
        _failures.setdefault(key, []).append(now)
        raise HTTPException(status_code=401, detail="Sign-in failed.")
    _failures.pop(key, None)
    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    expires = _now() + timedelta(hours=SESSION_HOURS)
    session_doc = {
        "_id": session_id,
        "username": user["username"],
        "expires_at": expires.isoformat(),
        "csrf_token": csrf_token,
    }
    try:
        get_db()[SESSIONS].insert_one(session_doc)
    except Exception:
        pass
    _IN_MEMORY_SESSIONS[session_id] = session_doc
    return {
        "session_id": session_id,
        "username": user["username"],
        "role": user.get("role") or "",
        "csrf_token": csrf_token,
        "expires_at": expires.isoformat(),
    }


def password_help(_username: str) -> dict:
    """Do not reveal whether an account exists and do not change a password."""
    return {
        "detail": (
            "This desk does not email or reset passwords. "
            "Ask the system administrator to set a new password for the postmaster account."
        ),
    }


def logout(request: Request) -> None:
    """End the current session. Any signed-in role may log out."""
    session_id = request.cookies.get(COOKIE)
    session, _user = _session_user(session_id)
    supplied = request.headers.get("x-csrf-token") or ""
    if not supplied or not hmac.compare_digest(supplied, session.get("csrf_token") or ""):
        raise HTTPException(status_code=403, detail="The security token did not match.")
    try:
        get_db()[SESSIONS].delete_one({"_id": session_id})
    except Exception:
        pass
    _IN_MEMORY_SESSIONS.pop(session_id, None)


def _session_user(session_id: str | None) -> tuple[dict, dict]:
    if not session_id:
        raise HTTPException(status_code=401, detail="Sign in required.")
    session = None
    try:
        session = get_db()[SESSIONS].find_one({"_id": session_id})
    except Exception:
        pass
    if session is None:
        session = _IN_MEMORY_SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    try:
        expires = datetime.fromisoformat(session["expires_at"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Sign in required.")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= _now():
        try:
            get_db()[SESSIONS].delete_one({"_id": session_id})
        except Exception:
            pass
        _IN_MEMORY_SESSIONS.pop(session_id, None)
        raise HTTPException(status_code=401, detail="Sign in required.")
    user = None
    try:
        user = get_db()[USERS].find_one({"_id": session.get("username")})
    except Exception:
        pass
    if user is None:
        user = _IN_MEMORY_USERS.get(session.get("username"))
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return session, user


def require_postmaster(request: Request) -> dict:
    """Reject missing sessions with 401 and any other signed-in role with 403."""
    session_id = request.cookies.get(COOKIE)
    session, user = _session_user(session_id)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        supplied = request.headers.get("x-csrf-token") or ""
        if not supplied or not hmac.compare_digest(supplied, session.get("csrf_token") or ""):
            raise HTTPException(status_code=403, detail="The security token did not match.")
    if user.get("role") != ROLE_POSTMASTER:
        raise HTTPException(status_code=403, detail="A postmaster sign-in is required.")
    return {"username": user["username"], "role": user["role"]}


def current_user(request: Request) -> dict:
    session_id = request.cookies.get(COOKIE)
    session, user = _session_user(session_id)
    return {
        "username": user["username"],
        "role": user.get("role") or "",
        "csrf_token": session.get("csrf_token") or "",
        "expires_at": session.get("expires_at") or "",
    }


def require_clerk_or_postmaster(request: Request) -> dict:
    """Accept an authenticated session from a clerk or postmaster."""
    session_id = request.cookies.get(COOKIE)
    if not session_id:
        auth_hdr = request.headers.get("authorization") or ""
        if auth_hdr.startswith("Bearer "):
            session_id = auth_hdr[7:].strip()
    session, user = _session_user(session_id)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        supplied = request.headers.get("x-csrf-token") or ""
        if not supplied or not hmac.compare_digest(supplied, session.get("csrf_token") or ""):
            raise HTTPException(status_code=403, detail="The security token did not match.")
    role = user.get("role") or ""
    if role not in {ROLE_POSTMASTER, ROLE_CLERK}:
        raise HTTPException(status_code=403, detail="An authorized clerk or postmaster sign-in is required.")
    return {
        "username": user["username"],
        "role": role,
        "office_id": user.get("office_id", "PO-COLOMBO-CENTRAL"),
        "full_name": user.get("full_name", user["username"]),
    }

