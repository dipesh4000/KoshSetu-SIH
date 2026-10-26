"""In-app notices.

A notice stays findable after it is read: marking it read is not the same as
acknowledging the action, and neither is the same as the action being done.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.api import schemas
from app.api.deps import CurrentPrincipal, DbSession
from app.core.authorization import not_found
from app.db.base import utcnow
from app.db.models import NotificationEvent

router = APIRouter(tags=["notifications"])


def _scoped(principal):
    scopes = [f"INSTITUTION:{institution_id}" for institution_id in principal.institution_ids]
    scopes.append(f"USER:{principal.user_id}")
    conditions = [NotificationEvent.recipient_scope.in_(scopes)]
    if principal.is_official:
        # Officials see the portfolio deadline notices for their scope as well.
        conditions.append(NotificationEvent.recipient_scope.startswith("INSTITUTION:"))
    return select(NotificationEvent).where(or_(*conditions))


@router.get("/notifications", response_model=list[schemas.NotificationOut])
def list_notifications(
    principal: CurrentPrincipal,
    db: DbSession,
    category: str | None = None,
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
):
    principal.require("notification:read")
    statement = _scoped(principal)
    if category:
        statement = statement.where(NotificationEvent.category == category)
    if unread_only:
        statement = statement.where(NotificationEvent.read_at.is_(None))
    rows = db.scalars(statement.order_by(NotificationEvent.created_at.desc()).limit(limit))
    return [
        schemas.NotificationOut.model_validate(row, from_attributes=True) for row in rows
    ]


@router.get("/notifications/unread-count")
def unread_count(principal: CurrentPrincipal, db: DbSession):
    principal.require("notification:read")
    rows = list(db.scalars(_scoped(principal).where(NotificationEvent.read_at.is_(None))))
    return {
        "unread": len(rows),
        "action_required": len([r for r in rows if r.category == "ACTION_REQUIRED"]),
    }


@router.post("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_read(notification_id: str, principal: CurrentPrincipal, db: DbSession):
    principal.require("notification:read")
    row = db.scalar(_scoped(principal).where(NotificationEvent.id == notification_id))
    if row is None:
        raise not_found()
    if row.read_at is None:
        row.read_at = utcnow()
        db.commit()
    return schemas.NotificationOut.model_validate(row, from_attributes=True)


@router.post("/notifications/{notification_id}/ack", response_model=schemas.NotificationOut)
def acknowledge(notification_id: str, principal: CurrentPrincipal, db: DbSession):
    """Idempotent acknowledgement of the notice, not of the underlying task."""
    principal.require("notification:read")
    row = db.scalar(_scoped(principal).where(NotificationEvent.id == notification_id))
    if row is None:
        raise not_found()
    if row.acknowledged_at is None:
        row.acknowledged_at = utcnow()
        row.read_at = row.read_at or utcnow()
        row.status = "ACKNOWLEDGED"
        db.commit()
    return schemas.NotificationOut.model_validate(row, from_attributes=True)
