# SignBridge Animation Service (Phase 1)
#
# Launch:
#   .venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
#
# The service wraps the existing SignBridge repository (read-only, never
# modified).  Generated videos go to OUTPUT_DIR (~/signbridge-service/outputs)
# with a unique filename per request.
