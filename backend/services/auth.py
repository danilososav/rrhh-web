"""
services/auth.py — Autenticación JWT para el Portal RRHH Texo.

Usuarios definidos en la variable de entorno USERS:
    USERS="usuario1:contraseña1,usuario2:contraseña2"

Secreto del token en JWT_SECRET (generar con: openssl rand -hex 32).
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

SECRET_KEY: str = os.getenv("JWT_SECRET", "dev-secret-cambiame-en-produccion")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

_bearer = HTTPBearer()


# ── Usuarios ──────────────────────────────────────────────────────────────────

def _load_users() -> dict[str, str]:
    """Parsea USERS='user1:pass1,user2:pass2,...' → {username: password}"""
    raw = os.getenv("USERS", "")
    users: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            username, password = pair.split(":", 1)
            users[username.strip()] = password.strip()
    return users


def authenticate_user(username: str, password: str) -> bool:
    """Verifica credenciales contra la lista de usuarios del entorno."""
    users = _load_users()
    stored = users.get(username)
    return stored is not None and stored == password


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_token(username: str) -> str:
    """Genera un JWT con expiración de TOKEN_EXPIRE_HOURS horas."""
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    Dependencia FastAPI: valida el JWT del header Authorization: Bearer <token>.
    Devuelve el username si es válido; lanza 401 si no.
    """
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido.")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")
