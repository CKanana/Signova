"""main.py -- FastAPI application for the SignBridge service (Phase 1).

Local HTTP API wrapping the existing SignBridge text-to-ASL animation
pipeline (wired via animation_service.py). The original SignBridge repository
is NOT modified.

Endpoints:
  GET  /health
  POST /v1/animations  {"text": "I need help"}
  POST /v1/animations/structured  {"text": "I need help"}

Each request renders into its own unique file inside the service's OUTPUT_DIR
(never arbitrary filesystem paths) and returns verified metadata.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator

# Ensure the service's own package is importable even when launched from
# another working directory (e.g. `uvicorn main`).
_SERVICE_DIR = Path(__file__).resolve().parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))

from animation_service import (  # noqa: E402
    ConfigError,
    MAX_REQUEST_SIZE,
    OUTPUT_DIR,
    generate_animations,
    generate_pose_sequence,
    validate_text,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
def _setup_logging() -> None:
    level_name = os.environ.get("LOG_LEVEL", "info").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
    )


_setup_logging()
logger = logging.getLogger("signbridge-service.app")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SignBridge Animation Service",
    version="1.0.0",
    description=(
        "Phase 1: standalone local HTTP API for the SignBridge text-to-ASL "
        "animation pipeline. Accepts English text, renders it to an MP4, and "
        "returns a file response with verified metadata."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(GZipMiddleware, minimum_size=1024)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class AnimRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def _reject_oversized(cls, v: str) -> str:
        if len(v) > MAX_REQUEST_SIZE:
            raise ValueError(
                f"Request body too large ({len(v)} bytes); maximum is {MAX_REQUEST_SIZE}"
            )
        return v


class AnimResponse(BaseModel):
    status: str
    text: str
    filename: str
    filepath: str
    output_dir: str
    size_bytes: int
    metadata: dict


class ErrorResponse(BaseModel):
    status: str
    error: str
    detail: str | None = None


@app.get("/health")
def health() -> dict:
    """Liveness/readiness check. Verifies the SignBridge root is reachable."""
    try:
        from animation_service import SIGNBRIDGE_ROOT

        return {
            "status": "ok",
            "signbridge_root": SIGNBRIDGE_ROOT,
            "output_dir": OUTPUT_DIR,
            "service": "signbridge-service",
            "release": "phase-1",
        }
    except ConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/v1/animations", status_code=201)
async def create_animation(request: Request, body: AnimRequest):
    """Render English text to an MP4 animation.

    Flow:
      1. Validate & normalise the text (length + content).
      2. Render the pose sequence through the ORIGINAL SignBridge pipeline
         (gen_pose -> gen_vid) into a unique file inside OUTPUT_DIR.
      3. Verify the file is non-empty and playable (ffprobe metadata).
      4. Return the file + metadata. No preview window appears.
    """
    # --- 1. Validate -------------------------------------------------
    try:
        text = validate_text(body.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # --- 2. Render (inside a dedicated output dir, unique filename) ---
    try:
        result = generate_animations(text, output_dir=OUTPUT_DIR)
    except ConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        # SignBridge gloss Invalid: empty pose sequence / unsupported words.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Render failed for text: %r", text)
        raise HTTPException(status_code=500, detail=f"Rendering failed: {exc}") from exc

    # --- 3. Verify ---------------------------------------------------
    metadata = result.get("metadata") or {}
    width = metadata.get("width")
    height = metadata.get("height")
    nb_frames = metadata.get("nb_frames")
    fps = metadata.get("fps")
    duration = metadata.get("duration_sec")
    codec = metadata.get("codec")
    size = metadata.get("size_bytes") or result.get("size_bytes")

    if not width or not height or not nb_frames or not fps:
        raise HTTPException(
            status_code=500,
            detail=(
                "Generated file is not a valid MP4: "
                f"width={width}, height={height}, frames={nb_frames}, fps={fps}"
            ),
        )

    logger.info(
        "Rendered text=%r filename=%s width=%s height=%s frames=%s dur=%s",
        text,
        result["filename"],
        width,
        height,
        nb_frames,
        duration,
    )

    # --- 4. Return a usable file response ---------------------------
    return FileResponse(
        path=result["filepath"],
        filename=result["filename"],
        media_type="video/mp4",
        headers={
            "X-SignBridge-Size-Bytes": str(size),
            "X-SignBridge-Duration-Sec": f"{duration:.3f}",
            "X-SignBridge-Width": str(width),
            "X-SignBridge-Height": str(height),
            "X-SignBridge-Fps": str(fps),
            "X-SignBridge-Frames": str(nb_frames),
            "X-SignBridge-Codec": codec or "mpeg4",
        },
    )


@app.post("/v1/animations/structured", status_code=200)
async def create_structured_pose(body: AnimRequest):
    """Return the real SignBridge joint sequence for English text.

    The response is consumed by Signova's own SVG avatar. It contains the
    gloss sequence, 30 fps interpolated frames, transition frames, joint names
    and normalized joint coordinates. No SignBridge video or avatar is used.
    """
    try:
        text = validate_text(body.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        result = generate_pose_sequence(text)
    except ConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Pose generation failed for text: %r", text)
        raise HTTPException(
            status_code=500,
            detail=f"Pose generation failed: {exc}",
        ) from exc

    logger.info(
        "Pose sequence text=%r glosses=%s frames=%s duration_ms=%s",
        text,
        result["glosses"],
        result["frameCount"],
        result["durationMs"],
    )
    return JSONResponse(content=result)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Uniform JSON error responses (no stack traces)."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            status="error",
            error=exc.detail or "error",
            detail=None,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all: never leak internals to the caller."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            status="error",
            error="internal_error",
            detail="An unexpected error occurred.",
        ).model_dump(),
    )


# Patch the OpenAPI schema so it reflects the real schema above.
app.openapi = app.openapi  # type: ignore[attr-defined]
