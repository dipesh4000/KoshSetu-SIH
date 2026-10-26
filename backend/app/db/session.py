from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

_engine_kwargs: dict[str, object] = {"pool_pre_ping": True, "future": True}

if settings.is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
elif settings.is_serverless:
    # A serverless invocation may be frozen between requests, so a pooled
    # connection cannot be trusted to still be open. Each request opens and
    # closes its own; use the provider's pooled endpoint for the fan-out.
    _engine_kwargs["poolclass"] = NullPool
    _engine_kwargs["connect_args"] = {"connect_timeout": 10}
    # Nothing to revalidate: the connection was opened by this request. The
    # liveness check would only add a round trip, and these run far from the
    # database.
    _engine_kwargs["pool_pre_ping"] = False
else:
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 5
    _engine_kwargs["pool_recycle"] = 300

engine: Engine = create_engine(settings.database_url, **_engine_kwargs)

if settings.is_sqlite:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_constraints(dbapi_connection, _record) -> None:  # pragma: no cover
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionFactory = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def get_db() -> Iterator[Session]:
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()
