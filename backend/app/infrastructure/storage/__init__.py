"""Private object store facade.

The backend is chosen by configuration, not by call sites: `filesystem` for a
local run, `database` where the runtime has no durable disk. Both expose the
same contract, so the upload, scan and download paths are identical either way.

Callers pass the request's session where they have one. The filesystem backend
ignores it; the database backend joins it, so the object and the row that
references it share one transaction.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.infrastructure.storage import db_store, local_store, minio_store

QUARANTINE_PREFIX = local_store.QUARANTINE_PREFIX
CLEAN_PREFIX = local_store.CLEAN_PREFIX
REJECTED_PREFIX = local_store.REJECTED_PREFIX


def _uses_database() -> bool:
    if settings.storage_backend not in {"filesystem", "database", "minio"}:  # pragma: no cover
        raise RuntimeError(f"Unknown storage backend: {settings.storage_backend}")
    return settings.storage_backend == "database"


def backend_name() -> str:
    return settings.storage_backend


def build_quarantine_key(institution_id: str, extension: str = "pdf") -> str:
    module = db_store if _uses_database() else local_store
    return module.build_quarantine_key(institution_id, extension)


def put_object(key: str, payload: bytes, *, session: Session | None = None) -> int:
    if settings.storage_backend == "minio":
        return minio_store.put_object(key, payload, session=session)
    if _uses_database():
        return db_store.put_object(key, payload, session=session)
    return local_store.put_object(key, payload)


def read_object(key: str, *, session: Session | None = None) -> bytes:
    if settings.storage_backend == "minio":
        return minio_store.read_object(key, session=session)
    if _uses_database():
        return db_store.read_object(key, session=session)
    return local_store.read_object(key)


def object_exists(key: str, *, session: Session | None = None) -> bool:
    if settings.storage_backend == "minio":
        return minio_store.object_exists(key, session=session)
    if _uses_database():
        return db_store.object_exists(key, session=session)
    return local_store.object_exists(key)


def object_size(key: str, *, session: Session | None = None) -> int:
    if settings.storage_backend == "minio":
        return minio_store.object_size(key, session=session)
    if _uses_database():
        return db_store.object_size(key, session=session)
    return local_store.object_size(key)


def promote(key: str, *, to_prefix: str, session: Session | None = None) -> str:
    if settings.storage_backend == "minio":
        return minio_store.promote(key, to_prefix=to_prefix, session=session)
    if _uses_database():
        return db_store.promote(key, to_prefix=to_prefix, session=session)
    return local_store.promote(key, to_prefix=to_prefix)
