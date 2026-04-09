"""
routers/auth.py — POST /auth/login
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.auth import authenticate_user, create_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    if not authenticate_user(body.username, body.password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    return {"access_token": create_token(body.username), "token_type": "bearer"}
