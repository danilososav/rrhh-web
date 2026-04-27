import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from services.auth import verify_token
from services import data_cache

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_MODULES = {"nomina", "rotacion", "costos", "reclutamiento", "respuestas"}
SHARED_KEY = "shared"


@router.get("/{module}")
def get_module(module: str):
    if module not in VALID_MODULES:
        raise HTTPException(status_code=404, detail="Módulo no encontrado.")
    try:
        return {"data": data_cache.load(SHARED_KEY, module)}
    except Exception as exc:
        logger.error("Cache GET %s failed: %s", module, exc)
        raise HTTPException(status_code=500, detail=f"Error al leer cache: {exc}")


@router.put("/{module}")
def put_module(
    module: str,
    payload: dict[str, Any] = Body(...),
    username: str = Depends(verify_token),
):
    if module not in VALID_MODULES:
        raise HTTPException(status_code=404, detail="Módulo no encontrado.")
    try:
        data_cache.save(SHARED_KEY, module, payload.get("data"))
        return {"ok": True}
    except Exception as exc:
        logger.error("Cache PUT %s/%s failed: %s", username, module, exc)
        raise HTTPException(status_code=500, detail=f"Error al guardar cache: {exc}")
