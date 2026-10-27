"""Upgrade a disposable legacy database and preserve its existing user."""

import os
import subprocess
import sys


def test_migration_adopts_legacy_schema_without_resetting_data(tmp_path):
    script = """
from alembic import command
from alembic.config import Config
from sqlalchemy import text, inspect
from app.db.session import engine
config = Config("alembic.ini")
command.upgrade(config, "0001_legacy")
with engine.begin() as db:
    db.execute(text("INSERT INTO users(id,email,display_name,password_hash,active,mfa_enrolled,created_at,updated_at) VALUES ('legacy-user','legacy@example.demo','Legacy user','placeholder',true,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
    db.execute(text("DELETE FROM alembic_version"))
command.upgrade(config, "head")
command.upgrade(config, "head")
with engine.connect() as db:
    assert db.scalar(text("SELECT email FROM users WHERE id='legacy-user'")) == "legacy@example.demo"
    assert db.scalar(text("SELECT version_num FROM alembic_version")) == "0002_security"
    assert 'revoked_sessions' in inspect(db).get_table_names()
"""
    env = {
        **os.environ,
        "KOSHSETU_DATABASE_URL": f"sqlite:///{tmp_path / 'migration.db'}",
        "KOSHSETU_STORAGE_ROOT": str(tmp_path / "objects"),
    }
    result = subprocess.run(
        [sys.executable, "-c", script],
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
