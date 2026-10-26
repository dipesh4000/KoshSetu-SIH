"""Serverless entrypoint.

The platform looks for an ASGI application named `app` in this module. The
backend package lives in `backend/`, so it is put on the import path here
rather than restructuring the repository around one deployment target.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402  (import must follow the path setup)

__all__ = ["app"]
