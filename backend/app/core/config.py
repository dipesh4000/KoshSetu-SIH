"""Validated application settings.

Environment gates live here so a misconfigured deployment fails at startup
rather than silently enabling demo-only behaviour, losing uploaded documents on
an ephemeral disk, or running with a development secret.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Managed Postgres add-ons expose their URL under their own names. The first
# one present is used when no explicit KOSHSETU_DATABASE_URL is configured.
MANAGED_DATABASE_ENV_VARS = (
    "DATABASE_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL",
    "NEON_DATABASE_URL",
)


def _discover_database_url() -> str | None:
    for name in MANAGED_DATABASE_ENV_VARS:
        value = os.environ.get(name)
        if value:
            return value
    return None


def normalise_database_url(url: str) -> str:
    """Make a provider-issued URL usable by SQLAlchemy.

    Managed Postgres hands out `postgres://…`, which SQLAlchemy does not accept,
    and the driver has to be named explicitly. TLS is required for any managed
    instance, so `sslmode` is added when the provider left it off.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]

    if url.startswith("postgresql+psycopg://"):
        parts = urlsplit(url)
        query = parts.query
        if "sslmode=" not in query:
            query = f"{query}&sslmode=require" if query else "sslmode=require"
        # A pooled endpoint cannot prepare statements across connections.
        if "channel_binding=" in query:
            query = "&".join(
                item for item in query.split("&") if not item.startswith("channel_binding=")
            )
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="KOSHSETU_",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = Field(default="local", pattern="^(local|demo|production)$")
    database_url: str = ""
    jwt_secret: str = "insecure-local-development-secret"
    jwt_ttl_minutes: int = 60
    fdr_hmac_key: str = "insecure-local-development-hmac"
    mock_bank_enabled: bool = True

    storage_backend: str = Field(default="filesystem", pattern="^(filesystem|database)$")
    storage_root: Path = Path("./data/objects")

    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_content_types: tuple[str, ...] = ("application/pdf",)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    expose_docs: bool = True

    # Schema creation runs at startup locally. A hosted deployment calls the
    # guarded bootstrap route once instead, so a cold start does no DDL.
    auto_create_schema: bool | None = None
    # Shared secret for the bootstrap and scheduled-task routes. CRON_SECRET is
    # read as a fallback because schedulers commonly set that name.
    bootstrap_secret: str = Field(default_factory=lambda: os.environ.get("CRON_SECRET", ""))

    @field_validator("storage_root")
    @classmethod
    def _absolute_storage(cls, value: Path) -> Path:
        return value.expanduser().resolve()

    @model_validator(mode="after")
    def _resolve_database_url(self) -> "Settings":
        url = self.database_url or _discover_database_url() or "sqlite:///./data/koshsetu.db"
        object.__setattr__(self, "database_url", normalise_database_url(url))
        if self.auto_create_schema is None:
            object.__setattr__(self, "auto_create_schema", self.environment == "local")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_serverless(self) -> bool:
        """True on a platform whose filesystem and process are ephemeral."""
        return bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    cfg = Settings()

    if cfg.is_production:
        if cfg.mock_bank_enabled:
            raise RuntimeError("Mock bank adapter must never be enabled in production")
        if "insecure-local" in cfg.jwt_secret or "insecure-local" in cfg.fdr_hmac_key:
            raise RuntimeError("Development secrets cannot be used in production")

    if cfg.environment != "local" and (
        "insecure-local" in cfg.jwt_secret or "insecure-local" in cfg.fdr_hmac_key
    ):
        raise RuntimeError(
            "Set KOSHSETU_JWT_SECRET and KOSHSETU_FDR_HMAC_KEY before deploying. "
            "The development defaults would let anyone mint a session."
        )

    if cfg.is_serverless:
        if cfg.storage_backend == "filesystem":
            raise RuntimeError(
                "This runtime has no durable filesystem. Set "
                "KOSHSETU_STORAGE_BACKEND=database so uploaded documents survive."
            )
        if cfg.is_sqlite:
            raise RuntimeError(
                "This runtime has no durable filesystem. Configure a Postgres "
                "DATABASE_URL instead of SQLite."
            )

    if cfg.storage_backend == "filesystem":
        cfg.storage_root.mkdir(parents=True, exist_ok=True)
    if cfg.is_sqlite:
        Path("./data").mkdir(parents=True, exist_ok=True)
    return cfg


settings = get_settings()
