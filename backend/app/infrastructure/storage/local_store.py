"""Private object store.

A local filesystem stands in for the private S3-compatible bucket described in
the backend brief. The important properties are preserved: keys are generated
(never the user's filename), objects land in a quarantine namespace first, and
nothing is served directly to a browser — downloads go through an authorized,
short-lived ticket issued by the API.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from app.core.config import settings

QUARANTINE_PREFIX = "quarantine"
CLEAN_PREFIX = "clean"
REJECTED_PREFIX = "rejected"


def build_quarantine_key(institution_id: str, extension: str = "pdf") -> str:
    return f"{QUARANTINE_PREFIX}/{settings.environment}/{institution_id}/{uuid4()}.{extension}"


def _absolute(key: str) -> Path:
    path = (settings.storage_root / key).resolve()
    if not path.is_relative_to(settings.storage_root.resolve()):
        raise ValueError("object key escapes the storage root")
    return path


def put_object(key: str, payload: bytes) -> int:
    path = _absolute(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return len(payload)


def read_object(key: str) -> bytes:
    return _absolute(key).read_bytes()


def object_exists(key: str) -> bool:
    return _absolute(key).exists()


def object_size(key: str) -> int:
    return _absolute(key).stat().st_size


def promote(key: str, *, to_prefix: str) -> str:
    """Move an object between namespaces once scanning has a verdict."""
    source = _absolute(key)
    parts = key.split("/", 1)
    new_key = f"{to_prefix}/{parts[1]}" if len(parts) == 2 else f"{to_prefix}/{key}"
    target = _absolute(new_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(target))
    return new_key


def local_path(key: str) -> Path:
    return _absolute(key)
