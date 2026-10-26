"""Audit explorer and operational routes."""

from __future__ import annotations

from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api import schemas
from app.api.deps import CurrentPrincipal, DbSession
from app.db.models import AuditEvent, OutboxEvent
from app.domains.audit.service import verify_chain
from app.domains.notifications.scheduler import dispatch_outbox, run_maturity_scan

router = APIRouter(tags=["audit"])


@router.get("/audit-events", response_model=list[schemas.AuditEventOut])
def list_audit_events(
    principal: CurrentPrincipal,
    db: DbSession,
    aggregate_id: str | None = None,
    aggregate_type: str | None = None,
    action: str | None = None,
    actor: str | None = None,
    outcome: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    principal.require("audit:read")
    statement = select(AuditEvent)
    if aggregate_id:
        statement = statement.where(AuditEvent.aggregate_id == aggregate_id)
    if aggregate_type:
        statement = statement.where(AuditEvent.aggregate_type == aggregate_type)
    if action:
        statement = statement.where(AuditEvent.action.ilike(f"%{action}%"))
    if actor:
        statement = statement.where(AuditEvent.actor_label.ilike(f"%{actor}%"))
    if outcome:
        statement = statement.where(AuditEvent.outcome == outcome)
    if date_from:
        statement = statement.where(
            AuditEvent.occurred_at >= datetime.combine(date_from, time.min, timezone.utc)
        )
    if date_to:
        statement = statement.where(
            AuditEvent.occurred_at <= datetime.combine(date_to, time.max, timezone.utc)
        )
    rows = db.scalars(
        statement.order_by(AuditEvent.occurred_at.desc()).limit(limit).offset(offset)
    )
    return [schemas.AuditEventOut.model_validate(row, from_attributes=True) for row in rows]


@router.get("/audit-events/integrity")
def audit_integrity(principal: CurrentPrincipal, db: DbSession):
    """Recompute the digest chain.

    This demonstrates tamper evidence. It is not a claim of immutability: a
    privileged database operator can still alter rows, which is why a
    deployment also revokes UPDATE/DELETE and exports signed checkpoints.
    """
    principal.require("audit:read")
    result = verify_chain(db)
    result["note"] = (
        "Tamper evidence through digest chaining. Full immutability requires "
        "separate write-only roles and WORM storage under an independent principal."
    )
    return result


@router.post("/ops/maturity-scan")
def trigger_maturity_scan(principal: CurrentPrincipal, db: DbSession):
    """Run the threshold scan on demand.

    A deployment runs this on a schedule (Celery Beat in the brief). Running it
    twice cannot create a duplicate logical reminder.
    """
    principal.require("audit:read")
    return run_maturity_scan(db)


@router.post("/ops/dispatch-outbox")
def trigger_outbox_dispatch(principal: CurrentPrincipal, db: DbSession):
    principal.require("audit:read")
    return dispatch_outbox(db)


@router.get("/ops/outbox")
def list_outbox(principal: CurrentPrincipal, db: DbSession, limit: int = 50):
    principal.require("audit:read")
    rows = db.scalars(
        select(OutboxEvent).order_by(OutboxEvent.available_at.desc()).limit(limit)
    )
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "aggregate_type": row.aggregate_type,
            "aggregate_id": row.aggregate_id,
            "payload_redacted": row.payload_redacted,
            "available_at": row.available_at,
            "dispatched_at": row.dispatched_at,
            "attempt_count": row.attempt_count,
        }
        for row in rows
    ]
