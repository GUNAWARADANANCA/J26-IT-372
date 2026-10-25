from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..audit import audit
from ..db import get_db
from ..schemas import LoginIn
from ..security import create_token, get_current_user, public_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginIn, request: Request):
    user = get_db().users.find_one({"username": body.username.strip().lower()})
    if not user or not user.get("active", True) or not verify_password(body.password, user["password_hash"]):
        audit(body.username[:40], "auth.login_failed", "user", {"client": request.client.host if request.client else None},
              severity="security")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong username or password")
    audit(user["username"], "auth.login", "user")
    return {"token": create_token(user), "user": public_user(user)}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    office = get_db().offices.find_one({"_id": user.get("office_id")}, {"name": 1})
    return {**public_user(user), "office_name": office["name"] if office else None}
