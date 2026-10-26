"""Database-backed private object store.

Same contract as the filesystem store: generated keys, a quarantine namespace
nothing may read from until scanning clears it, and no browser-visible address.
Used where the runtime has no durable filesystem, such as a serverless
deployment.

Every operation joins the caller's session when one is passed, so the object
and the row that references it commit or roll back together — a second
connection would take its own write lock and could leave an orphaned blob
behind a failed request.
"""

from __future__ import annotations

from contextlib import contextmanager
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import new_id
from app.db.models import ObjectBlob
from app.db.session import SessionFactory

QUARANTINE_PREFIX = "quarantine"
CLEAN_PREFIX = "clean"
REJECTED_PREFIX = "rejected"


@contextmanager
def _session_scope(session: Session | None):
    """Use the caller's transaction, or open and commit a short one."""
    if session is not None:
        yield session, False
        return
    own = SessionFactory()
    try:
        yield own, True
        own.commit()
    except Exception:
        own.rollback()
        raise
    finally:
        own.close()


def build_quarantine_key(institution_id: str, extension: str = "pdf") -> str:
    return f"{QUARANTINE_PREFIX}/{settings.environment}/{institution_id}/{uuid4()}.{extension}"


def put_object(
    key: str,
    payload: bytes,
    *,
    content_type: str = "application/pdf",
    session: Session | None = None,
) -> int:
    with _session_scope(session) as (db, _owns):
        existing = db.scalar(select(ObjectBlob).where(ObjectBlob.object_key == key))
        if existing is not None:
            existing.payload = payload
            existing.size_bytes = len(payload)
            existing.content_type = content_type
        else:
            db.add(
                ObjectBlob(
                    id=new_id(),
                    object_key=key,
                    content_type=content_type,
                    size_bytes=len(payload),
                    payload=payload,
                )
            )
        db.flush()
    return len(payload)


def read_object(key: str, *, session: Session | None = None) -> bytes:
    with _session_scope(session) as (db, _owns):
        blob = db.scalar(select(ObjectBlob).where(ObjectBlob.object_key == key))
        if blob is None:
            raise FileNotFoundError(key)
        # psycopg may hand back a memoryview for a bytea column.
        return bytes(blob.payload)


def object_exists(key: str, *, session: Session | None = None) -> bool:
    with _session_scope(session) as (db, _owns):
        return db.scalar(select(ObjectBlob.id).where(ObjectBlob.object_key == key)) is not None


def object_size(key: str, *, session: Session | None = None) -> int:
    with _session_scope(session) as (db, _owns):
        size = db.scalar(select(ObjectBlob.size_bytes).where(ObjectBlob.object_key == key))
        if size is None:
            raise FileNotFoundError(key)
        return size


def promote(key: str, *, to_prefix: str, session: Session | None = None) -> str:
    """Move an object between namespaces once scanning has a verdict."""
    parts = key.split("/", 1)
    new_key = f"{to_prefix}/{parts[1]}" if len(parts) == 2 else f"{to_prefix}/{key}"
    with _session_scope(session) as (db, _owns):
        blob = db.scalar(select(ObjectBlob).where(ObjectBlob.object_key == key))
        if blob is None:
            raise FileNotFoundError(key)
        blob.object_key = new_key
        db.flush()
    return new_key
