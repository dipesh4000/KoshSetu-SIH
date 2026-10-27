"""Scoped operational measurements from recorded events and dates."""

from collections import defaultdict
from datetime import timedelta
from statistics import median

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentPrincipal, DbSession, scoped_fdr_query
from app.db.base import utcnow, as_utc
from app.db.models import FdrSubmission, ReviewDecision, Institution
from app.domains.fdr.service import today

router = APIRouter(tags=["analytics"])


@router.get("/analytics/turnaround")
def turnaround(principal: CurrentPrincipal, db: DbSession):
    principal.require("report:read")
    instruments = list(db.scalars(scoped_fdr_query(principal)))
    ids = [fdr.id for fdr in instruments]
    submissions = {}
    for row in db.scalars(
        select(FdrSubmission)
        .where(FdrSubmission.fdr_id.in_(ids))
        .order_by(FdrSubmission.submitted_at)
    ):
        submissions.setdefault(row.fdr_id, row.submitted_at)
    decisions = {}
    for row in db.scalars(
        select(ReviewDecision)
        .where(ReviewDecision.fdr_id.in_(ids))
        .order_by(ReviewDecision.created_at)
    ):
        if row.decision in ("ACCEPT", "ACCEPTED", "REJECT", "REJECTED"):
            decisions.setdefault(row.fdr_id, row.created_at)
    durations = [
        max(0, (as_utc(decisions[key]) - as_utc(value)).total_seconds() / 3600)
        for key, value in submissions.items()
        if key in decisions
    ]
    groups = defaultdict(
        lambda: {"instruments": 0, "pending_review": 0, "maturing_90_days": 0}
    )
    start = today()
    for fdr in instruments:
        institution = db.get(Institution, fdr.institution_id)
        group = groups[
            (institution.region_code if institution else "Unknown", fdr.issuer_bank)
        ]
        group["instruments"] += 1
        group["pending_review"] += int(
            fdr.submission_status == "SUBMITTED"
            and fdr.review_status not in ("ACCEPTED", "REJECTED")
        )
        group["maturing_90_days"] += int(
            fdr.instrument_status in ("ACTIVE", "REGISTERED")
            and start <= fdr.maturity_date <= start + timedelta(days=90)
        )
    return {
        "as_of": utcnow(),
        "completed_reviews": len(durations),
        "median_review_hours": round(median(durations), 2) if durations else None,
        "groups": [
            {"region": region, "bank": bank, **counts}
            for (region, bank), counts in sorted(groups.items())
        ],
        "note": "Synthetic demo records. Turnaround measures first submission to first final scrutiny decision; open cases are excluded. This is not a measured productivity improvement.",
    }
