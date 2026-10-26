"""Maturity thresholds and the notification outbox.

PostgreSQL (or the demo SQLite database) is authoritative for instrument dates.
Each logical reminder has a deterministic dedupe key, so running the scheduler
repeatedly cannot produce a duplicate notice.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import new_id
from app.db.models import Fdr, Institution, NotificationEvent
from app.domains.audit.service import enqueue_outbox, record_audit

RULE_VERSION = "maturity-thresholds-1.0.0"

THRESHOLDS: tuple[tuple[str, int, str], ...] = (
    ("MATURITY_60_DAYS", 60, "INFORMATION"),
    ("MATURITY_30_DAYS", 30, "DEADLINE"),
    ("MATURITY_15_DAYS", 15, "DEADLINE"),
    ("MATURITY_7_DAYS", 7, "ACTION_REQUIRED"),
    ("MATURITY_DUE", 0, "ACTION_REQUIRED"),
)

ACTIVE_INSTRUMENT_STATES = ("REGISTERED", "ACTIVE")


def _dedupe_key(fdr: Fdr, event_type: str) -> str:
    return f"{event_type}:{fdr.id}:{fdr.maturity_date.isoformat()}:{RULE_VERSION}:INSTITUTION"


def run_maturity_scan(db: Session, *, today: date | None = None) -> dict[str, int]:
    """Insert due reminders. Safe to run repeatedly on the same day."""
    today = today or datetime.now(timezone.utc).date()
    created = 0
    skipped = 0

    instruments = list(
        db.scalars(select(Fdr).where(Fdr.instrument_status.in_(ACTIVE_INSTRUMENT_STATES)))
    )
    existing_keys = set(db.scalars(select(NotificationEvent.dedupe_key)))

    for fdr in instruments:
        days_remaining = (fdr.maturity_date - today).days
        institution = db.get(Institution, fdr.institution_id)
        institution_name = institution.name if institution else "the institution"

        for event_type, threshold, category in THRESHOLDS:
            if days_remaining > threshold:
                continue
            # Only the tightest applicable threshold is newly raised each run;
            # wider ones are inserted too so a late submission is not missed.
            key = _dedupe_key(fdr, event_type)
            if key in existing_keys:
                skipped += 1
                continue
            if days_remaining >= 0:
                title = f"Instrument matures in {days_remaining} day(s)"
                body = (
                    f"{institution_name}: instrument {fdr.fdr_number_masked} "
                    f"({fdr.issuer_bank}) matures on {fdr.maturity_date:%d %b %Y}. "
                    "Record the intended renewal, replacement or release action. "
                    "Maturity by itself is not a release approval."
                )
            else:
                title = f"Instrument matured {abs(days_remaining)} day(s) ago"
                body = (
                    f"{institution_name}: instrument {fdr.fdr_number_masked} matured on "
                    f"{fdr.maturity_date:%d %b %Y} and no action is recorded."
                )
            event = NotificationEvent(
                id=new_id(),
                fdr_id=fdr.id,
                event_type=event_type,
                category=category,
                title=title,
                body=body,
                due_date=fdr.maturity_date,
                recipient_scope=f"INSTITUTION:{fdr.institution_id}",
                dedupe_key=key,
                status="QUEUED",
            )
            db.add(event)
            existing_keys.add(key)
            enqueue_outbox(
                db,
                event_type="notification.queued",
                aggregate_type="notification_event",
                aggregate_id=event.id,
                payload={"fdr_id": fdr.id, "event_type": event_type},
            )
            created += 1

    record_audit(
        db,
        aggregate_type="scheduler",
        aggregate_id="maturity-scan",
        action="maturity.scan",
        new_state={"created": created, "skipped_duplicates": skipped, "as_of": today.isoformat()},
        reason="Scheduled maturity threshold evaluation",
    )
    db.commit()
    return {"created": created, "skipped_duplicates": skipped, "instruments_scanned": len(instruments)}


def notify_user(
    db: Session,
    *,
    user_id: str,
    title: str,
    body: str,
    category: str,
    dedupe_key: str,
    fdr_id: str | None = None,
    release_request_id: str | None = None,
    event_type: str = "CASE_UPDATE",
) -> NotificationEvent | None:
    if db.scalar(select(NotificationEvent).where(NotificationEvent.dedupe_key == dedupe_key)):
        return None
    event = NotificationEvent(
        id=new_id(),
        fdr_id=fdr_id,
        release_request_id=release_request_id,
        event_type=event_type,
        category=category,
        title=title,
        body=body,
        recipient_scope=f"USER:{user_id}",
        recipient_user_id=user_id,
        dedupe_key=dedupe_key,
        status="QUEUED",
    )
    db.add(event)
    return event


def dispatch_outbox(db: Session, *, limit: int = 50) -> dict[str, int]:
    """Stand-in for the queue dispatcher.

    Side effects happen only after the originating transaction committed. The
    demo marks events dispatched; a deployment hands them to an approved relay
    with a provider idempotency key and never emails document contents.
    """
    from app.db.base import utcnow
    from app.db.models import OutboxEvent

    pending = list(
        db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.dispatched_at.is_(None))
            .order_by(OutboxEvent.available_at)
            .limit(limit)
        )
    )
    for event in pending:
        event.attempt_count += 1
        event.dispatched_at = utcnow()
    db.commit()
    return {"dispatched": len(pending)}
