from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from services.auth import verify_token
from services import data_cache

router = APIRouter()

VALID_MODULES = {"nomina", "rotacion", "costos", "reclutamiento"}


@router.get("/{module}")
def get_module(module: str, username: str = Depends(verify_token)):
    if module not in VALID_MODULES:
        raise HTTPException(status_code=404, detail="Módulo no encontrado.")
    return {"data": data_cache.load(username, module)}


@router.put("/{module}")
def put_module(
    module: str,
    payload: dict[str, Any] = Body(...),
    username: str = Depends(verify_token),
):
    if module not in VALID_MODULES:
        raise HTTPException(status_code=404, detail="Módulo no encontrado.")
    data_cache.save(username, module, payload.get("data"))
    return {"ok": True}
