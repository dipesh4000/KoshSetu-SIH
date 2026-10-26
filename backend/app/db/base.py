from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    """Declarative base.

    String UUID primary keys keep the schema portable between the SQLite demo
    database and the PostgreSQL deployment described in the backend brief.
    """


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class IdMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)


def as_utc(value: datetime | None) -> datetime | None:
    """Normalise a stored timestamp to an aware UTC value.

    SQLite drops the offset on round-trip, and a timestamptz column comes back
    in the database session's timezone. Both are converted here so comparisons
    and the audit digest do not depend on which database is behind them.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
