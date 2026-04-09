from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="RRHH Texo API",
    version="1.0.0",
    description="Backend API para el Portal de RRHH de Texo",
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
# Orígenes exactos permitidos
_exact_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    os.getenv("FRONTEND_URL", ""),   # dominio Vercel exacto, p. ej. https://rrhh-texo.vercel.app
]
_exact_origins = [o for o in _exact_origins if o]

# Patrones de origen permitidos (cubre previews de Vercel como https://rrhh-texo-git-*.vercel.app)
_origin_regex = r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_exact_origins,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
from routers import nomina, rotacion, reclutamiento, costos, resumen
app.include_router(nomina.router,         prefix="/api/nomina",         tags=["nomina"])
app.include_router(rotacion.router,       prefix="/api/rotacion",       tags=["rotacion"])
app.include_router(reclutamiento.router,  prefix="/api/reclutamiento",  tags=["reclutamiento"])
app.include_router(costos.router,         prefix="/api/costos",         tags=["costos"])
app.include_router(resumen.router,        prefix="/api/resumen",        tags=["resumen"])


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Captura cualquier excepción no controlada y devuelve un JSON limpio sin stacktrace.
    HTTPException se re-lanza para que FastAPI la maneje normalmente.
    """
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Intentá de nuevo o contactá soporte."},
    )


@app.get("/")
def health_check():
    return {"status": "ok", "app": "RRHH Texo API"}
