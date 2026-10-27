"""Transaction-scoped locks shared by processes and serverless instances."""

import hashlib

from sqlalchemy import text, update
from sqlalchemy.orm import Session

from app.db.models import TransactionLock


def transaction_lock(db: Session, name: str) -> None:
    if db.get_bind().dialect.name == "postgresql":
        key = int.from_bytes(
            hashlib.sha256(name.encode()).digest()[:8], "big", signed=True
        )
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})
    else:
        from sqlalchemy.dialects.sqlite import insert

        db.execute(
            insert(TransactionLock).values(id=name, value=0).on_conflict_do_nothing()
        )
        db.execute(
            update(TransactionLock).where(TransactionLock.id == name).values(value=0)
        )
