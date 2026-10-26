"""Append-only audit writing with digest chaining.

The chain gives tamper *evidence*, not immutability: a privileged database
operator can still rewrite rows. A production deployment additionally revokes
UPDATE/DELETE from the application role and exports signed checkpoints.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.authorization import Principal
from app.db.base import as_utc, new_id, utcnow
from app.db.models import AuditEvent, OutboxEvent

SENSITIVE_KEYS = {"fdr_number", "password", "token", "authorization", "object_key"}


def redact(payload: dict[str, Any]) -> dict[str, Any]:
    """Keep full FDR numbers, keys and credentials out of audit and outbox rows."""
    safe: dict[str, Any] = {}
    for key, value in payload.items():
        if key.lower() in SENSITIVE_KEYS:
            safe[key] = "[redacted]"
        elif isinstance(value, dict):
            safe[key] = redact(value)
        else:
            safe[key] = value
    return safe


def record_audit(
    db: Session,
    *,
    aggregate_type: str,
    aggregate_id: str,
    action: str,
    actor: Principal | None = None,
    outcome: str = "ALLOW",
    old_state: dict[str, Any] | None = None,
    new_state: dict[str, Any] | None = None,
    reason: str | None = None,
    request_id: str | None = None,
) -> AuditEvent:
    previous = db.scalar(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(1))
    previous_digest = previous.integrity_digest if previous else None
    occurred_at = utcnow()
    old_summary = json.dumps(redact(old_state or {}), sort_keys=True, default=str)
    new_summary = json.dumps(redact(new_state or {}), sort_keys=True, default=str)
    digest_source = "|".join(
        [
            previous_digest or "GENESIS",
            aggregate_type,
            aggregate_id,
            action,
            outcome,
            actor.user_id if actor else "system",
            old_summary,
            new_summary,
            as_utc(occurred_at).isoformat(),
        ]
    )
    event = AuditEvent(
        id=new_id(),
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        actor_id=actor.user_id if actor else None,
        actor_label=f"{actor.display_name} <{actor.email}>" if actor else "system",
        action=action,
        outcome=outcome,
        old_state_summary=old_summary,
        new_state_summary=new_summary,
        reason=reason,
        request_id=request_id,
        previous_digest=previous_digest,
        integrity_digest=hashlib.sha256(digest_source.encode()).hexdigest(),
        occurred_at=occurred_at,
    )
    db.add(event)
    return event


def enqueue_outbox(
    db: Session,
    *,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    payload: dict[str, Any] | None = None,
) -> OutboxEvent:
    event = OutboxEvent(
        id=new_id(),
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        payload_redacted=json.dumps(redact(payload or {}), sort_keys=True, default=str),
        available_at=utcnow(),
    )
    db.add(event)
    return event


def verify_chain(db: Session) -> dict[str, Any]:
    """Recompute the digest chain and report the first divergence, if any."""
    events = list(db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at)))
    previous_digest: str | None = None
    for event in events:
        digest_source = "|".join(
            [
                previous_digest or "GENESIS",
                event.aggregate_type,
                event.aggregate_id,
                event.action,
                event.outcome,
                event.actor_id or "system",
                event.old_state_summary or "{}",
                event.new_state_summary or "{}",
                as_utc(event.occurred_at).isoformat(),
            ]
        )
        expected = hashlib.sha256(digest_source.encode()).hexdigest()
        if expected != event.integrity_digest:
            return {"verified": False, "events_checked": len(events), "first_divergence": event.id}
        previous_digest = event.integrity_digest
    return {"verified": True, "events_checked": len(events), "first_divergence": None}
