"""Overview, maturity, exception and report routes.

Aggregates are computed in the database over the principal's authorized scope.
The client never sums paginated rows into a headline figure.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, select

from app.api import schemas
from app.api.deps import CurrentPrincipal, DbSession, scoped_fdr_query
from app.db.base import utcnow
from app.db.models import (
    AuditEvent,
    ClearanceRequirement,
    Fdr,
    FdrLink,
    Finding,
    Institution,
    NotificationEvent,
    ReleaseRequest,
)
from app.domains.fdr import service
from app.domains.risk.engine import load_catalog

router = APIRouter(tags=["dashboards"])

MONTH_LABELS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _scope_label(principal) -> str:
    if principal.is_institution_user:
        return "Your institution"
    if principal.region_codes:
        return f"Assigned region: {', '.join(sorted(principal.region_codes))}"
    return "All assigned records"


@router.get("/overview", response_model=schemas.OverviewOut)
def overview(principal: CurrentPrincipal, db: DbSession):
    principal.require("fdr:read")
    today = service.today()
    base = scoped_fdr_query(principal).subquery()
    scoped = select(Fdr).join(base, Fdr.id == base.c.id)

    def count_where(*conditions) -> int:
        statement = select(func.count()).select_from(Fdr).join(base, Fdr.id == base.c.id)
        for condition in conditions:
            statement = statement.where(condition)
        return int(db.scalar(statement) or 0)

    active_principal = db.scalar(
        select(func.coalesce(func.sum(Fdr.principal_amount), 0))
        .select_from(Fdr)
        .join(base, Fdr.id == base.c.id)
        .where(Fdr.instrument_status == "ACTIVE", Fdr.review_status == "ACCEPTED")
    ) or 0

    kpis = [
        schemas.KpiOut(
            key="active_principal",
            label="Active principal on record",
            value=f"{Decimal(active_principal):.2f}",
            unit="INR",
            inclusion_criteria=(
                "Instruments with instrument_status ACTIVE whose scrutiny decision is ACCEPTED."
            ),
            filter_hint={"instrument_status": "ACTIVE", "review_status": "ACCEPTED"},
        ),
        schemas.KpiOut(
            key="active_instruments",
            label="Active instruments",
            value=str(count_where(Fdr.instrument_status == "ACTIVE")),
            unit="count",
            inclusion_criteria="instrument_status = ACTIVE.",
            filter_hint={"instrument_status": "ACTIVE"},
        ),
        schemas.KpiOut(
            key="maturing_30",
            label="Maturing in 30 days",
            value=str(
                count_where(
                    Fdr.instrument_status.in_(["REGISTERED", "ACTIVE"]),
                    Fdr.maturity_date >= today,
                    Fdr.maturity_date <= today + timedelta(days=30),
                )
            ),
            unit="count",
            inclusion_criteria=(
                "Derived from maturity_date against today; it is not a stored status."
            ),
            filter_hint={"maturity_band": "30"},
        ),
        schemas.KpiOut(
            key="pending_verification",
            label="Awaiting bank-source check",
            value=str(
                count_where(
                    Fdr.submission_status == "SUBMITTED",
                    Fdr.bank_verification_status.in_(["NOT_REQUESTED", "PENDING"]),
                )
            ),
            unit="count",
            inclusion_criteria="Submitted instruments with no recorded bank-source result.",
            filter_hint={"bank_verification_status": "NOT_REQUESTED"},
        ),
        schemas.KpiOut(
            key="awaiting_review",
            label="Awaiting officer review",
            value=str(
                count_where(
                    Fdr.submission_status == "SUBMITTED",
                    Fdr.review_status.in_(["QUEUED", "IN_REVIEW", "CLARIFICATION_REQUIRED"]),
                )
            ),
            unit="count",
            inclusion_criteria="Submitted instruments whose review has not concluded.",
            filter_hint={"review_status": "QUEUED"},
        ),
        schemas.KpiOut(
            key="open_release_cases",
            label="Open release cases",
            value=str(
                int(
                    db.scalar(
                        select(func.count())
                        .select_from(ReleaseRequest)
                        .where(ReleaseRequest.status.notin_(["CLOSED", "REJECTED", "APPROVED"]))
                    )
                    or 0
                )
                if principal.is_official
                else int(
                    db.scalar(
                        select(func.count())
                        .select_from(ReleaseRequest)
                        .where(
                            ReleaseRequest.institution_id.in_(principal.institution_ids or [""]),
                            ReleaseRequest.status.notin_(["CLOSED", "REJECTED", "APPROVED"]),
                        )
                    )
                    or 0
                )
            ),
            unit="count",
            inclusion_criteria="Release requests that are neither decided nor closed.",
            filter_hint={},
        ),
    ]

    by_month: dict[str, dict[str, Decimal | int]] = defaultdict(
        lambda: {"count": 0, "amount": Decimal(0)}
    )
    for fdr in db.scalars(scoped):
        key = f"{MONTH_LABELS[fdr.maturity_date.month - 1]} {fdr.maturity_date.year}"
        bucket = by_month[key]
        bucket["count"] = int(bucket["count"]) + 1
        bucket["amount"] = Decimal(bucket["amount"]) + Decimal(fdr.principal_amount)

    maturity_by_month = [
        schemas.MaturityBucketOut(
            label=key, month=key, count=int(value["count"]), amount=f"{Decimal(value['amount']):.2f}"
        )
        for key, value in sorted(
            by_month.items(),
            key=lambda item: (int(item[0].split()[1]), MONTH_LABELS.index(item[0].split()[0])),
        )
    ][:12]

    backlog_bands = (("0-2 days", 0, 2), ("3-7 days", 3, 7), ("8-30 days", 8, 30), ("30+ days", 31, 3650))
    verification_backlog: list[schemas.MaturityBucketOut] = []
    for label, low, high in backlog_bands:
        count = count_where(
            Fdr.submission_status == "SUBMITTED",
            Fdr.review_status.in_(["QUEUED", "IN_REVIEW", "CLARIFICATION_REQUIRED"]),
            Fdr.updated_at <= utcnow() - timedelta(days=low),
            Fdr.updated_at >= utcnow() - timedelta(days=high + 1),
        )
        verification_backlog.append(
            schemas.MaturityBucketOut(label=label, count=count, amount="0.00")
        )

    attention_ids = list(
        db.scalars(
            select(Finding.fdr_id)
            .where(Finding.status == "OPEN", Finding.severity.in_(["BLOCKER", "CRITICAL", "HIGH"]))
            .distinct()
            .limit(200)
        )
    )
    action_needed = [
        service.to_list_item(db, fdr)
        for fdr in db.scalars(
            scoped.where(Fdr.id.in_(attention_ids or ["__none__"]))
            .order_by(Fdr.maturity_date)
            .limit(10)
        )
    ]

    recent = [
        schemas.AuditEventOut.model_validate(event, from_attributes=True)
        for event in db.scalars(
            select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(8)
        )
    ] if principal.has("audit:read") else []

    return schemas.OverviewOut(
        scope_label=_scope_label(principal),
        as_of=utcnow(),
        kpis=kpis,
        maturity_by_month=maturity_by_month,
        verification_backlog=verification_backlog,
        action_needed=action_needed,
        recent_activity=recent,
    )


@router.get("/maturities", response_model=list[schemas.MaturityItemOut])
def maturities(
    principal: CurrentPrincipal,
    db: DbSession,
    band: str = Query(default="30", pattern="^(7|15|30|60|90|OVERDUE|MATURED)$"),
):
    """Server-derived due windows. A date is never a release approval."""
    principal.require("fdr:read")
    today = service.today()
    statement = scoped_fdr_query(principal)

    if band == "OVERDUE":
        statement = statement.where(
            Fdr.maturity_date < today, Fdr.instrument_status.in_(["REGISTERED", "ACTIVE"])
        )
    elif band == "MATURED":
        statement = statement.where(Fdr.maturity_date < today)
    else:
        statement = statement.where(
            Fdr.maturity_date >= today, Fdr.maturity_date <= today + timedelta(days=int(band))
        )

    items: list[schemas.MaturityItemOut] = []
    for fdr in db.scalars(statement.order_by(Fdr.maturity_date).limit(200)):
        remaining = service.days_remaining(fdr, as_of=today)
        reminders = int(
            db.scalar(
                select(func.count())
                .select_from(NotificationEvent)
                .where(NotificationEvent.fdr_id == fdr.id)
            )
            or 0
        )
        predecessor = db.scalar(
            select(FdrLink.predecessor_fdr_id).where(FdrLink.successor_fdr_id == fdr.id)
        )
        successor = db.scalar(
            select(FdrLink.successor_fdr_id).where(FdrLink.predecessor_fdr_id == fdr.id)
        )

        if fdr.instrument_status == "SUPERSEDED":
            next_action = "Replacement recorded; verify the successor instrument's evidence."
        elif fdr.instrument_status == "RELEASE_RECORDED":
            next_action = "Release approved administratively; await bank-side evidence."
        elif remaining < 0:
            next_action = "Overdue: escalate per the applicable grace and policy rules."
        elif fdr.review_status != "ACCEPTED":
            next_action = "Complete scrutiny before deciding renewal, replacement or release."
        elif remaining <= load_catalog().thresholds.get("maturity_critical_days", 7):
            next_action = "Assign an owner and record the intended action now."
        else:
            next_action = "Confirm the institution's intended renewal, replacement or release."

        items.append(
            schemas.MaturityItemOut(
                fdr=service.to_list_item(db, fdr, as_of=today),
                band="OVERDUE" if remaining < 0 else f"{band}_DAYS",
                next_action=next_action,
                reminders_sent=reminders,
                predecessor_id=predecessor,
                successor_id=successor,
            )
        )
    return items


@router.get("/exceptions", response_model=list[schemas.FindingOut])
def exceptions(
    principal: CurrentPrincipal,
    db: DbSession,
    category: str | None = None,
    severity: str | None = None,
    finding_status: str = Query(default="OPEN", alias="status"),
    limit: int = Query(default=100, ge=1, le=300),
):
    principal.require("finding:read")
    scoped_ids = select(scoped_fdr_query(principal).subquery().c.id)
    statement = select(Finding).where(Finding.fdr_id.in_(scoped_ids))
    if category:
        statement = statement.where(Finding.category == category)
    if severity:
        statement = statement.where(Finding.severity == severity)
    if finding_status != "ALL":
        statement = statement.where(Finding.status == finding_status)

    results: list[schemas.FindingOut] = []
    for finding in db.scalars(statement.order_by(Finding.detected_at.desc()).limit(limit)):
        fdr = db.get(Fdr, finding.fdr_id)
        institution = db.get(Institution, fdr.institution_id) if fdr else None
        results.append(
            service.to_finding_out(
                finding,
                institution_name=institution.name if institution else None,
                masked=fdr.fdr_number_masked if fdr else None,
            )
        )
    return results


@router.get("/rules")
def rule_catalog(principal: CurrentPrincipal):
    """The versioned rule table behind every finding and attention level."""
    principal.require("finding:read")
    catalog = load_catalog()
    return {
        "ruleset_name": catalog.name,
        "version": catalog.version,
        "sha256": catalog.sha256,
        "thresholds": catalog.thresholds,
        "rules": list(catalog.rules.values()),
        "note": (
            "Findings are deterministic rule outcomes with evidence references. "
            "There is no fraud score and no trained predictor."
        ),
    }


@router.get("/reports/{report_key}", response_model=schemas.ReportRowOut)
def report(report_key: str, principal: CurrentPrincipal, db: DbSession):
    principal.require("report:read")
    rows, columns = _report_rows(db, principal, report_key)
    return schemas.ReportRowOut(
        columns=columns,
        rows=rows,
        report_run_id=f"rpt-{uuid4()}",
        scope_label=_scope_label(principal),
        generated_at=utcnow(),
        watermark="DEMO ENVIRONMENT — SYNTHETIC DATA — SIMULATED BANK EVIDENCE",
    )


@router.get("/reports/{report_key}/export")
def export_report(report_key: str, principal: CurrentPrincipal, db: DbSession):
    """Scope is re-checked here, and the export carries its provenance header."""
    principal.require("report:export")
    rows, columns = _report_rows(db, principal, report_key)
    run_id = f"rpt-{uuid4()}"

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([f"# KoshSetu report {report_key}"])
    writer.writerow([f"# run_id={run_id}"])
    writer.writerow([f"# scope={_scope_label(principal)}"])
    writer.writerow([f"# generated_at={utcnow().isoformat()}"])
    writer.writerow(["# DEMO ENVIRONMENT - SYNTHETIC DATA - SIMULATED BANK EVIDENCE"])
    writer.writerow(columns)
    writer.writerows(rows)

    from app.domains.audit.service import record_audit

    record_audit(
        db,
        aggregate_type="report",
        aggregate_id=run_id,
        action="report.exported",
        actor=principal,
        new_state={"report_key": report_key, "row_count": len(rows)},
    )
    db.commit()

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{report_key}-{run_id}.csv"',
            "Cache-Control": "no-store",
        },
    )


def _report_rows(db, principal, report_key: str) -> tuple[list[list[str]], list[str]]:
    from app.core.authorization import invalid

    scoped = scoped_fdr_query(principal)
    if report_key == "active-exposure":
        columns = [
            "Institution",
            "AICTE id",
            "Instrument (masked)",
            "Issuer bank",
            "Principal (INR)",
            "Maturity",
            "Instrument status",
            "Review status",
            "Bank check (source)",
        ]
        rows = []
        for fdr in db.scalars(scoped.order_by(Fdr.maturity_date)):
            institution = db.get(Institution, fdr.institution_id)
            rows.append(
                [
                    institution.name if institution else "",
                    institution.aicte_id if institution else "",
                    fdr.fdr_number_masked,
                    fdr.issuer_bank,
                    f"{Decimal(fdr.principal_amount):.2f}",
                    fdr.maturity_date.isoformat(),
                    fdr.instrument_status,
                    fdr.review_status,
                    f"{fdr.bank_verification_status} (simulated)",
                ]
            )
        return rows, columns

    if report_key == "upcoming-maturities":
        columns = ["Institution", "Instrument (masked)", "Maturity", "Days remaining", "Next action owner"]
        today = service.today()
        rows = []
        for fdr in db.scalars(
            scoped.where(
                Fdr.maturity_date >= today, Fdr.maturity_date <= today + timedelta(days=90)
            ).order_by(Fdr.maturity_date)
        ):
            institution = db.get(Institution, fdr.institution_id)
            rows.append(
                [
                    institution.name if institution else "",
                    fdr.fdr_number_masked,
                    fdr.maturity_date.isoformat(),
                    str(service.days_remaining(fdr, as_of=today)),
                    fdr.assigned_officer_id or "unassigned",
                ]
            )
        return rows, columns

    if report_key == "unresolved-findings":
        columns = ["Rule", "Severity", "Category", "Instrument (masked)", "Institution", "Status", "Detected"]
        scoped_ids = select(scoped.subquery().c.id)
        rows = []
        for finding in db.scalars(
            select(Finding)
            .where(Finding.fdr_id.in_(scoped_ids), Finding.status == "OPEN")
            .order_by(Finding.severity)
        ):
            fdr = db.get(Fdr, finding.fdr_id)
            institution = db.get(Institution, fdr.institution_id) if fdr else None
            rows.append(
                [
                    finding.rule_id,
                    finding.severity,
                    finding.category,
                    fdr.fdr_number_masked if fdr else "",
                    institution.name if institution else "",
                    finding.status,
                    finding.detected_at.date().isoformat(),
                ]
            )
        return rows, columns

    if report_key == "clearance-backlog":
        columns = ["Request", "Institution", "Basis", "Bureau", "State", "Case status", "Opened"]
        rows = []
        for requirement in db.scalars(
            select(ClearanceRequirement).where(ClearanceRequirement.state != "CLEARED")
        ):
            request_row = db.get(ReleaseRequest, requirement.request_id)
            if request_row is None:
                continue
            if db.scalar(scoped.where(Fdr.id == request_row.fdr_id)) is None:
                continue
            if principal.is_institution_user and request_row.institution_id not in principal.institution_ids:
                continue
            institution = db.get(Institution, request_row.institution_id)
            rows.append(
                [
                    request_row.id[:8],
                    institution.name if institution else "",
                    request_row.basis_code,
                    requirement.bureau_code,
                    requirement.state,
                    request_row.status,
                    request_row.created_at.date().isoformat(),
                ]
            )
        return rows, columns

    raise invalid(f"Unknown report: {report_key}")
