"""Validated application settings.

Environment gates live here so that a misconfigured deployment fails at
startup rather than silently enabling demo-only behaviour in production.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="KOSHSETU_",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = Field(default="local", pattern="^(local|demo|production)$")
    database_url: str = "sqlite:///./data/koshsetu.db"
    jwt_secret: str = "insecure-local-development-secret"
    jwt_ttl_minutes: int = 60
    fdr_hmac_key: str = "insecure-local-development-hmac"
    mock_bank_enabled: bool = True
    storage_root: Path = Path("./data/objects")
    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_content_types: tuple[str, ...] = ("application/pdf",)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    expose_docs: bool = True

    @field_validator("storage_root")
    @classmethod
    def _absolute_storage(cls, value: Path) -> Path:
        return value.expanduser().resolve()

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    cfg = Settings()
    if cfg.is_production:
        if cfg.mock_bank_enabled:
            raise RuntimeError("Mock bank adapter must never be enabled in production")
        if "insecure-local" in cfg.jwt_secret or "insecure-local" in cfg.fdr_hmac_key:
            raise RuntimeError("Development secrets cannot be used in production")
    cfg.storage_root.mkdir(parents=True, exist_ok=True)
    return cfg


settings = get_settings()
