"""Authentication for staff (JWT) and IoT devices (per-device secret key).

* Passwords: PBKDF2-HMAC-SHA256 with a per-user salt (standard library only).
* Staff sessions: short-lived JWT carrying the username and role; the user is
  re-read from the database on each request so a deactivated account stops
  working immediately.
* Devices: ``X-Device-Id`` + ``X-Device-Key`` headers. Only the SHA-256 of the
  key is stored. Use HTTPS outside a closed lab network.
* Worker identity for scan events is always taken from the token, never from
  the request body (proposal appendix A1.5).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .db import get_db

ROLES = ("admin", "postmaster", "counter_officer", "hub_officer", "postman")
PBKDF2_ITERATIONS = 390_000

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_b64, digest_b64 = stored.split("$")
        assert algo == "pbkdf2_sha256"
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(iterations))
        return hmac.compare_digest(digest, base64.b64decode(digest_b64))
    except Exception:  # noqa: BLE001 - malformed hash -> no match
        return False


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def create_token(user: dict) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": user["username"], "role": user["role"], "iat": now,
               "exp": now + timedelta(minutes=s.jwt_expire_minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def public_user(user: dict) -> dict:
    return {k: user.get(k) for k in ("username", "full_name", "role", "office_id", "beat_postcodes", "active")}


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "authentication required",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(creds.credentials, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"}) from None
    user = get_db().users.find_one({"username": payload.get("sub")})
    if not user or not user.get("active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "account not active")
    return user


def require_roles(*roles: str):
    allowed = set(roles) | {"admin"}

    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"role '{user['role']}' cannot perform this action")
        return user
    return dependency


def get_device(request: Request, x_device_id: str = Header(default=""), x_device_key: str = Header(default="")) -> dict:
    device = get_db().devices.find_one({"_id": x_device_id}) if x_device_id else None
    if not device or not device.get("active", True) or not x_device_key or \
            not hmac.compare_digest(device.get("key_hash", ""), hash_secret(x_device_key)):
        from .audit import audit
        audit("device", "device.auth_failed", x_device_id or "unknown",
              {"client": request.client.host if request.client else None}, severity="security")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown device or wrong key")
    return device
