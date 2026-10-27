"""Use the same validated URL and connection settings as the application."""

from alembic import context
from app.db.base import Base
from app.db.session import engine
from app.core.config import settings
from app.db import models  # noqa: F401

if context.is_offline_mode():
    context.configure(
        url=settings.database_url, target_metadata=Base.metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=Base.metadata, compare_type=True
        )
        with context.begin_transaction():
            context.run_migrations()
