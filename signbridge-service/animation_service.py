"""animation_service.py -- SignBridge integration and headless rendering.

Phase 1 of the SignBridge service. This module binds the existing SignBridge
pipeline to a local HTTP API:

  * Reuses the ORIGINAL, untouched SignBridge code:
      - gen_pose() from SignBridge/main.py   (English text -> gloss sequence)
      - gen_vid() / AnimationDirector from SignBridge/animation_lib.py
        (gloss sequence -> MP4 animation)

  * Performs only a service-local headless adaptation so rendering works
    without any preview window and without cv2.waitKey() interaction:
      - cv2.imshow("Preview", img)       -> no-op
      - cv2.waitKey(1)                   -> no-op (never stops for 'q')
    These are restored on shutdown so the original cv2 module is untouched.

  * Each request writes to its own unique file inside the service's OUTPUT_DIR.

Usage (internal):
    from animation_service import generate_animations, validate_text, get_video_metadata
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
import time
import logging
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger("signbridge-service")


# ---------------------------------------------------------------------------
# Configuration (read from .env / environment, NOT from the SignBridge repo)
# ---------------------------------------------------------------------------
def _load_env_file(path: Path) -> None:
    """Parse a simple KEY=VALUE .env file into ``os.environ`` (no deps)."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _ensure_abs_path(value: str, name: str) -> str:
    p = os.path.abspath(value)
    if not p:
        raise ConfigError(f"{name} is empty")
    return p


class ConfigError(Exception):
    """Raised when a service configuration value is invalid/missing."""


# ---------------------------------------------------------------------------
# Configuration (read from .env / environment, NOT from the SignBridge repo)
# ---------------------------------------------------------------------------
ENV_FILE = Path(__file__).resolve().parent / ".env"
_load_env_file(ENV_FILE)

SIGNBRIDGE_ROOT = _ensure_abs_path(
    os.environ.get("SIGNBRIDGE_ROOT", "C:/Users/kanan/signova-text-to-asl-lab/SignBridge"),
    "SIGNBRIDGE_ROOT",
)
OUTPUT_DIR = _ensure_abs_path(
    os.environ.get("OUTPUT_DIR", "C:/Users/kanan/OneDrive/Desktop/Signova/signbridge-service/outputs"),
    "OUTPUT_DIR",
)
MAX_TEXT_LENGTH = int(os.environ.get("MAX_TEXT_LENGTH", "5000"))
MAX_REQUEST_SIZE = int(os.environ.get("MAX_REQUEST_SIZE", str(2 * 1024 * 1024)))

# Validate the SignBridge root at import time.
if not os.path.isdir(SIGNBRIDGE_ROOT):
    raise ConfigError(
        f"SIGNBRIDGE_ROOT is not a directory: {SIGNBRIDGE_ROOT}. "
        "Point SIGNBRIDGE_ROOT at the existing SignBridge repository."
    )
if not os.path.isfile(os.path.join(SIGNBRIDGE_ROOT, "main.py")):
    raise ConfigError(
        f"SIGNBRIDGE_ROOT does not contain SignBridge main.py: {SIGNBRIDGE_ROOT}"
    )


# ---------------------------------------------------------------------------
# Headless adaptation (documented, minimal, reversible)
# ---------------------------------------------------------------------------
# The original SignBridge renderer opens a live preview window and waits for
# the 'q' key via cv2.imshow() / cv2.waitKey(). Those are replaced with
# no-ops for headless operation. The original cv2 module is restored on
# shutdown (see revert_cv2_preview()).

def _noop_cv2(*_args, **_kwargs):
    """No-op for cv2.imshow / cv2.waitKey so rendering is headless."""
    return 0


_cv2_original = None  # type: ignore[assignment]

if os.environ.get("SIGNBRIDGE_HEADLESS", "1") == "1":
    # Import cv2 so we can patch the module attributes the original code uses.
    import cv2  # noqa: F401

    _cv2_original = {
        "imshow": cv2.imshow,
        "waitKey": cv2.waitKey,
    }
    cv2.imshow = _noop_cv2
    cv2.waitKey = _noop_cv2


def revert_cv2_preview() -> None:
    """Restore the original cv2.imshow / cv2.waitKey (no-op if already patched)."""
    global _cv2_original
    if _cv2_original is not None:
        import cv2  # noqa: F401

        cv2.imshow = _cv2_original["imshow"]
        cv2.waitKey = _cv2_original["waitKey"]
        _cv2_original = None


# ---------------------------------------------------------------------------
# Lazy import of the ORIGINAL SignBridge entry point (main.py).
# main.py is heavy to import (whisper loads on module import), so we defer
# the import until the first render request.
# ---------------------------------------------------------------------------
_main_module = None  # type: ignore[assignment]
_main_loaded = False


def _import_signbridge_main() -> Any:
    """Import SignBridge.main from SIGNBRIDGE_ROOT exactly once (thread-safe)."""
    global _main_module, _main_loaded
    if _main_loaded:
        return _main_module
    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location(
        "signbridge_main", os.path.join(SIGNBRIDGE_ROOT, "main.py")
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load main.py from {SIGNBRIDGE_ROOT}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["signbridge_main"] = mod
    spec.loader.exec_module(mod)
    _main_module = mod
    _main_loaded = True
    return mod


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_text(text: str) -> str:
    """Validate and normalise user text for the SignBridge gloss engine."""
    if not isinstance(text, str):
        raise ValueError("Text must be a string")
    stripped = text.strip()
    if not stripped:
        raise ValueError("Text is required")
    if len(stripped) > MAX_TEXT_LENGTH:
        raise ValueError(
            f"Text is too long ({len(stripped)} characters); maximum is {MAX_TEXT_LENGTH}"
        )
    return stripped


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
def generate_animations(text: str, output_dir: Optional[str] = None) -> dict[str, Any]:
    """Render an English sentence to an MP4 animation.

    Returns a dict with ``filename``, ``filepath``, ``output_dir``, ``metadata``
    and ``status``. Raises ValueError for invalid input and RuntimeError/Unicode
    errors for rendering failures. Each call writes a unique file.
    """
    stripped = validate_text(text)

    # Unique filename per request.
    stamp = int(time.time() * 1000)
    filename = f"{stamp}_{uuid.uuid4().hex}.mp4"
    out_dir = os.path.abspath(output_dir or OUTPUT_DIR)
    os.makedirs(out_dir, exist_ok=True)
    filepath = os.path.join(out_dir, filename)

    # Chdir into the SignBridge root so the original (relative-path) code
    # resolves Pose/ and INPUT_AUDIO as intended. Reversible here (process-wide
    # but the service owns its lifetime).
    original_cwd = os.getcwd()
    try:
        os.chdir(SIGNBRIDGE_ROOT)
        _import_signbridge_main()
        main_module = sys.modules["signbridge_main"]

        # Reset cv2 preview hooks (already no-op, but restore/restage for safety).
        if os.environ.get("SIGNBRIDGE_HEADLESS", "1") == "1":
            revert_cv2_preview()

        # Reuse the ORIGINAL functions verbatim.
        gloss_sequence = main_module.gen_pose(stripped)
        if not gloss_sequence:
            raise ValueError("No valid gloss generated from the provided text.")

        main_module.gen_vid(gloss_sequence, filepath)
    finally:
        # Restore the previous working directory.
        os.chdir(original_cwd)
        # Ensure headless hooks are restored when done.
        if os.environ.get("SIGNBRIDGE_HEADLESS", "1") == "1":
            revert_cv2_preview()

    # --- Post-render verification (each request gets a usable, playable file) ---
    if not os.path.exists(filepath):
        raise RuntimeError(f"SignBridge renderer failed to write output: {filepath}")

    size = os.path.getsize(filepath)
    if size <= 0:
        raise RuntimeError(f"Generated file is empty: {filepath}")

    metadata = get_video_metadata(filepath)

    return {
        "status": "ok",
        "filename": filename,
        "filepath": filepath,
        "output_dir": out_dir,
        "size_bytes": size,
        "metadata": metadata,
    }


# ---------------------------------------------------------------------------
# Video metadata (ffprobe, using the system FFmpeg — no cv2.imread needed)
# ---------------------------------------------------------------------------
def _ffprobe_json(filepath: str) -> dict[str, Any]:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries",
        "stream=width,height,nb_frames,r_frame_rate,avg_frame_rate,codec_name",
        "-show_entries", "format=duration,size",
        "-of", "json",
        filepath,
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if out.returncode == 0:
            data = json.loads(out.stdout or "{}")
            return data
    except Exception as exc:  # noqa: BLE001
        logger.warning("ffprobe failed: %s", exc)
    # Fallback when ffprobe is unavailable.
    return {}


def get_video_metadata(filepath: str) -> dict[str, Any]:
    """Probe an MP4 and return width/height/nb_frames/fps/duration/codec."""
    info = _ffprobe_json(filepath)
    streams = info.get("streams") or []
    fmt = info.get("format") or {}
    stream = streams[0] if streams else {}

    width = stream.get("width")
    height = stream.get("height")
    nb_frames = stream.get("nb_frames")
    r_frame_rate = stream.get("r_frame_rate", "0/1")
    avg_frame_rate = stream.get("avg_frame_rate", "0/1")
    codec = stream.get("codec_name") or fmt.get("codec_name")

    # Compute fps and duration ourselves when the probe omits them.
    def parse_fps(rate: str) -> float:
        try:
            num, den = rate.split("/")
            return float(num) / float(den) if float(den) else 0.0
        except Exception:
            return 0.0

    def parse_duration(value: Optional[str]) -> float:
        if value:
            try:
                return float(value)
            except ValueError:
                return 0.0
        # estimate duration from frame count + fps
        try:
            n = int(nb_frames) if nb_frames else 0
            f = parse_fps(avg_frame_rate)
            return round(n / f, 3) if f else 0.0
        except Exception:
            return 0.0

    return {
        "width": width,
        "height": height,
        "nb_frames": nb_frames,
        "framerate": avg_frame_rate,
        "fps": round(parse_fps(avg_frame_rate), 3),
        "duration_sec": parse_duration(fmt.get("duration")),
        "codec": codec,
        "size_bytes": os.path.getsize(filepath),
        "file": os.path.basename(filepath),
    }


# ---------------------------------------------------------------------------
# Graceful fallbacks for unsupported glosses / empty pose sequences
# ---------------------------------------------------------------------------
# main.gen_pose() already filters out missing poses (prints a warning) and
# raises ValueError("No valid gloss generated...") when nothing remains.
# generate_animations() re-raises these as plain ValueError so the HTTP layer
# can translate them to 422 responses. No special-casing is required here.
