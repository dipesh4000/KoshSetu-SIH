"""Operational routes for a hosted deployment.

These are not part of the product surface: they create the schema once, load
the synthetic dataset, and let a scheduler run the work that a Celery beat
worker performs in the architecture the brief describes. Each one requires a
shared secret that is configured out of band, and none of them is reachable
when that secret is unset.
"""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.core.config import settings
from app.db.base import Base
from app.db.models import AuditEvent, Fdr, Institution, NotificationEvent, User
from app.db.session import engine
from app.domains.notifications.scheduler import dispatch_outbox, run_maturity_scan
from app.infrastructure import storage

router = APIRouter(tags=["ops"], prefix="/ops")

SecretHeader = Annotated[str | None, Header(alias="Authorization")]
AltSecretHeader = Annotated[str | None, Header(alias="X-Bootstrap-Secret")]


def _require_secret(authorization: str | None, alternative: str | None) -> None:
    """Accept either a bearer token or the explicit header, in constant time."""
    if not settings.bootstrap_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "DEPENDENCY_UNAVAILABLE",
                "message": "Operational routes are disabled: no bootstrap secret is configured.",
            },
        )

    presented = alternative or ""
    if not presented and authorization and authorization.lower().startswith("bearer "):
        presented = authorization.split(" ", 1)[1]

    if not presented or not hmac.compare_digest(presented, settings.bootstrap_secret):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "INSUFFICIENT_SCOPE", "message": "Not permitted."},
        )


@router.post("/bootstrap")
def bootstrap(
    db: DbSession,
    authorization: SecretHeader = None,
    x_bootstrap_secret: AltSecretHeader = None,
    step: str = Query(
        default="all",
        pattern="^(all|schema|seed|findings|reminders)$",
        description="Run one stage at a time where the runtime caps request duration.",
    ),
    batch: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0, description="Resume point for the findings stage."),
):
    """Create the schema and load the synthetic dataset.

    Every stage is idempotent and the stages are separately addressable,
    because a serverless runtime caps how long one request may take and the
    whole load does not always fit. Re-running a stage is always safe:
    `seed` skips a populated database, and `findings` only evaluates
    instruments that have none yet.
    """
    _require_secret(authorization, x_bootstrap_secret)

    from app.seed import rebuild_findings, seed

    result: dict[str, object] = {"step": step}

    if step in {"all", "schema"}:
        Base.metadata.create_all(bind=engine)
        result["schema"] = "ready"

    if step in {"all", "seed"}:
        already_seeded = db.scalar(select(func.count(User.id))) or 0
        result["seed"] = (
            {"status": "skipped", "reason": "database already seeded"}
            if already_seeded
            else seed(reset=False, include_derived=(step == "all"))
        )

    if step in {"all", "findings"}:
        result["findings"] = rebuild_findings(db, offset=offset, limit=batch)

    if step in {"all", "reminders"}:
        result["reminders"] = run_maturity_scan(db)
        result["outbox"] = dispatch_outbox(db)

    return {
        **result,
        "environment": settings.environment,
        "storage_backend": storage.backend_name(),
        "counts": {
            "institutions": db.scalar(select(func.count(Institution.id))) or 0,
            "users": db.scalar(select(func.count(User.id))) or 0,
            "instruments": db.scalar(select(func.count(Fdr.id))) or 0,
            "notifications": db.scalar(select(func.count(NotificationEvent.id))) or 0,
            "audit_events": db.scalar(select(func.count(AuditEvent.id))) or 0,
        },
    }


@router.post("/cron/maturity-scan")
@router.get("/cron/maturity-scan")
def scheduled_maturity_scan(
    db: DbSession,
    authorization: SecretHeader = None,
    x_bootstrap_secret: AltSecretHeader = None,
):
    """Threshold evaluation plus outbox dispatch.

    A scheduler calls this; it is idempotent, so a repeated run creates no
    duplicate reminder. GET is accepted because some schedulers only issue GET.
    """
    _require_secret(authorization, x_bootstrap_secret)
    scan = run_maturity_scan(db)
    dispatched = dispatch_outbox(db)
    return {"maturity_scan": scan, "outbox": dispatched}


@router.get("/status")
def operational_status(
    db: DbSession,
    authorization: SecretHeader = None,
    x_bootstrap_secret: AltSecretHeader = None,
):
    _require_secret(authorization, x_bootstrap_secret)
    return {
        "environment": settings.environment,
        "storage_backend": storage.backend_name(),
        "database": "postgresql" if not settings.is_sqlite else "sqlite",
        "serverless": settings.is_serverless,
        "mock_bank_enabled": settings.mock_bank_enabled,
        "auto_create_schema": settings.auto_create_schema,
        "counts": {
            "institutions": db.scalar(select(func.count(Institution.id))) or 0,
            "users": db.scalar(select(func.count(User.id))) or 0,
            "instruments": db.scalar(select(func.count(Fdr.id))) or 0,
            "audit_events": db.scalar(select(func.count(AuditEvent.id))) or 0,
        },
    }
