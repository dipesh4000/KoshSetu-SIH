"""Instrument registry, submission and scrutiny routes."""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import (
    CurrentPrincipal,
    DbSession,
    load_scoped_fdr,
    request_id_of,
    scoped_fdr_query,
)
from app.core.authorization import Principal, conflict, invalid, not_found
from app.core.security import (
    lookup_hash,
    mask_fdr_number,
    obfuscate_store,
)
from app.db.base import new_id, utcnow
from app.db.models import (
    Fdr,
    FdrLink,
    FdrSubmission,
    Finding,
    Institution,
    ReviewDecision,
    User,
)
from app.domains.audit.service import enqueue_outbox, record_audit
from app.domains.fdr import service
from app.domains.notifications.scheduler import notify_user
from app.domains.risk.engine import load_catalog, sync_findings

router = APIRouter(tags=["instruments"])

IdempotencyKey = Annotated[str | None, Header(alias="Idempotency-Key")]


def _resolve_institution(db: Session, principal: Principal) -> Institution:
    if not principal.institution_ids:
        raise not_found()
    institution = db.get(Institution, sorted(principal.institution_ids)[0])
    if institution is None or institution.status != "ACTIVE":
        raise not_found()
    return institution


@router.get("/fdrs", response_model=list[schemas.FdrListItem])
def list_fdrs(
    principal: CurrentPrincipal,
    db: DbSession,
    q: str | None = None,
    institution_id: str | None = None,
    issuer_bank: str | None = None,
    review_status: str | None = None,
    submission_status: str | None = None,
    instrument_status: str | None = None,
    bank_verification_status: str | None = None,
    maturity_band: str | None = Query(default=None, pattern="^(7|15|30|60|90|OVERDUE)$"),
    assigned_to_me: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    principal.require("fdr:read")
    statement = scoped_fdr_query(principal)

    if institution_id:
        # An institution id from the client narrows an already-scoped query; it
        # can never widen it.
        statement = statement.where(Fdr.institution_id == institution_id)
    if issuer_bank:
        statement = statement.where(Fdr.issuer_bank.ilike(f"%{issuer_bank}%"))
    if review_status:
        statement = statement.where(Fdr.review_status == review_status)
    if submission_status:
        statement = statement.where(Fdr.submission_status == submission_status)
    if instrument_status:
        statement = statement.where(Fdr.instrument_status == instrument_status)
    if bank_verification_status:
        statement = statement.where(Fdr.bank_verification_status == bank_verification_status)
    if assigned_to_me:
        statement = statement.where(Fdr.assigned_officer_id == principal.user_id)
    if maturity_band:
        today = service.today()
        if maturity_band == "OVERDUE":
            statement = statement.where(Fdr.maturity_date < today)
        else:
            from datetime import timedelta

            statement = statement.where(
                Fdr.maturity_date >= today,
                Fdr.maturity_date <= today + timedelta(days=int(maturity_band)),
            )
    if q:
        needle = f"%{q.strip()}%"
        statement = statement.join(Institution, Fdr.institution_id == Institution.id).where(
            Institution.name.ilike(needle)
            | Institution.aicte_id.ilike(needle)
            | Fdr.fdr_number_masked.ilike(needle)
            | Fdr.issuer_bank.ilike(needle)
        )

    statement = statement.order_by(Fdr.maturity_date).limit(limit).offset(offset)
    return [service.to_list_item(db, fdr) for fdr in db.scalars(statement)]


@router.post(
    "/fdrs/drafts", response_model=schemas.FdrDetailOut, status_code=status.HTTP_201_CREATED
)
def create_draft(
    payload: schemas.FdrDraftIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("fdr:draft")
    institution = _resolve_institution(db, principal)

    fdr = Fdr(
        id=new_id(),
        institution_id=institution.id,
        created_by=principal.user_id,
        issuer_bank=payload.issuer_bank.strip(),
        branch=payload.branch,
        ifsc=payload.ifsc,
        fdr_number_masked=mask_fdr_number(payload.fdr_number),
        fdr_number_ciphertext=obfuscate_store(payload.fdr_number.strip()),
        fdr_lookup_hash=lookup_hash(payload.issuer_bank, payload.fdr_number),
        principal_amount=payload.principal_amount,
        interest_rate=payload.interest_rate,
        issue_date=payload.issue_date,
        maturity_date=payload.maturity_date,
        lien_beneficiary=payload.lien_beneficiary,
        submission_status="DRAFT",
        document_processing_status="NOT_UPLOADED",
        bank_verification_status="NOT_REQUESTED",
        review_status="NOT_SUBMITTED",
        instrument_status="REGISTERED",
        lien_status="CLAIMED" if payload.lien_beneficiary else "UNKNOWN",
    )
    db.add(fdr)
    db.flush()
    record_audit(
        db,
        aggregate_type="fdr",
        aggregate_id=fdr.id,
        action="fdr.draft_created",
        actor=principal,
        new_state={
            "institution_id": institution.id,
            "issuer_bank": fdr.issuer_bank,
            "principal_amount": str(fdr.principal_amount),
            "maturity_date": fdr.maturity_date.isoformat(),
        },
        request_id=request_id_of(request),
    )
    db.commit()
    return service.to_detail(db, principal, fdr)


@router.get("/fdrs/{fdr_id}", response_model=schemas.FdrDetailOut)
def get_fdr(fdr_id: str, principal: CurrentPrincipal, db: DbSession):
    principal.require("fdr:read")
    fdr = load_scoped_fdr(db, principal, fdr_id)
    return service.to_detail(db, principal, fdr)


@router.patch("/fdrs/{fdr_id}/draft", response_model=schemas.FdrDetailOut)
def patch_draft(
    fdr_id: str,
    payload: schemas.FdrDraftPatch,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("fdr:draft")
    fdr = load_scoped_fdr(db, principal, fdr_id)
    if fdr.submission_status not in {"DRAFT", "CORRECTION_REQUESTED"}:
        raise conflict(
            "Attested values cannot be edited directly. Submit a correction with a reason."
        )

    old_state = {
        "principal_amount": str(fdr.principal_amount),
        "maturity_date": fdr.maturity_date.isoformat(),
        "issuer_bank": fdr.issuer_bank,
    }
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    fdr_number = updates.pop("fdr_number", None)

    for field, value in updates.items():
        setattr(fdr, field, value)
    if fdr_number:
        fdr.fdr_number_masked = mask_fdr_number(fdr_number)
        fdr.fdr_number_ciphertext = obfuscate_store(fdr_number.strip())
        fdr.fdr_lookup_hash = lookup_hash(fdr.issuer_bank, fdr_number)
    if fdr.maturity_date < fdr.issue_date:
        raise invalid("maturity_date cannot be before issue_date")
    if "lien_beneficiary" in updates:
        fdr.lien_status = "CLAIMED" if fdr.lien_beneficiary else "UNKNOWN"

    fdr.version += 1
    record_audit(
        db,
        aggregate_type="fdr",
        aggregate_id=fdr.id,
        action="fdr.draft_updated",
        actor=principal,
        old_state=old_state,
        new_state={
            "principal_amount": str(fdr.principal_amount),
            "maturity_date": fdr.maturity_date.isoformat(),
            "issuer_bank": fdr.issuer_bank,
            "version": fdr.version,
        },
        request_id=request_id_of(request),
    )
    db.commit()
    return service.to_detail(db, principal, fdr)


@router.post("/fdrs/{fdr_id}/submit", response_model=schemas.FdrDetailOut)
def submit_fdr(
    fdr_id: str,
    payload: schemas.SubmitIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
    idempotency_key: IdempotencyKey = None,
):
    """Attest and submit.

    Requires a clean, parsed document. The submitted snapshot is immutable, so
    later changes travel through a correction request instead.
    """
    principal.require("fdr:submit")
    fdr = load_scoped_fdr(db, principal, fdr_id)

    if fdr.submission_status == "SUBMITTED":
        # Idempotent: a repeated submit returns the current state.
        return service.to_detail(db, principal, fdr)
    if fdr.submission_status not in {"DRAFT", "UPLOADED", "CORRECTION_REQUESTED"}:
        raise conflict(f"An instrument in state {fdr.submission_status} cannot be submitted.")
    if fdr.document_processing_status not in {"READY", "MANUAL_REVIEW_REQUIRED"}:
        raise conflict(
            "Upload a document and wait for security scanning and extraction to finish "
            "before submitting."
        )
    if fdr.principal_amount <= 0:
        raise invalid("principal_amount must be greater than zero")

    if payload.corrections:
        allowed = {"principal_amount", "issue_date", "maturity_date", "lien_beneficiary"}
        unknown = set(payload.corrections) - allowed
        if unknown:
            raise invalid(f"Fields cannot be corrected here: {', '.join(sorted(unknown))}")
        for field, raw in payload.corrections.items():
            if field == "principal_amount":
                fdr.principal_amount = Decimal(raw)
            elif field in {"issue_date", "maturity_date"}:
                setattr(fdr, field, date.fromisoformat(raw))
            else:
                setattr(fdr, field, raw)
        if fdr.maturity_date < fdr.issue_date:
            raise invalid("maturity_date cannot be before issue_date")

    claims = {
        "issuer_bank": fdr.issuer_bank,
        "ifsc": fdr.ifsc,
        "principal_amount": str(fdr.principal_amount),
        "issue_date": fdr.issue_date.isoformat(),
        "maturity_date": fdr.maturity_date.isoformat(),
        "lien_beneficiary": fdr.lien_beneficiary,
        "corrections": payload.corrections,
        "correction_reason": payload.correction_reason,
        "idempotency_key": idempotency_key,
    }
    submission_count = (
        db.scalar(select(func.count(FdrSubmission.id)).where(FdrSubmission.fdr_id == fdr.id)) or 0
    )
    db.add(
        FdrSubmission(
            id=new_id(),
            fdr_id=fdr.id,
            submitted_by=principal.user_id,
            submitted_at=utcnow(),
            version=submission_count + 1,
            claims_json=json.dumps(claims, sort_keys=True),
            submission_status="SUBMITTED",
        )
    )

    old_status = fdr.submission_status
    fdr.submission_status = "SUBMITTED"
    fdr.review_status = "QUEUED"
    fdr.instrument_status = "ACTIVE" if fdr.instrument_status == "REGISTERED" else fdr.instrument_status
    fdr.version += 1

    sync_findings(db, fdr)
    record_audit(
        db,
        aggregate_type="fdr",
        aggregate_id=fdr.id,
        action="fdr.submitted",
        actor=principal,
        old_state={"submission_status": old_status},
        new_state={
            "submission_status": fdr.submission_status,
            "review_status": fdr.review_status,
            "version": fdr.version,
        },
        reason=payload.correction_reason or "Institution attestation",
        request_id=request_id_of(request),
    )
    enqueue_outbox(
        db,
        event_type="fdr.submitted",
        aggregate_type="fdr",
        aggregate_id=fdr.id,
        payload={"institution_id": fdr.institution_id},
    )
    db.commit()
    return service.to_detail(db, principal, fdr)


@router.post("/fdrs/{fdr_id}/scrutiny", response_model=schemas.FdrDetailOut)
def record_scrutiny(
    fdr_id: str,
    payload: schemas.ScrutinyIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Officer scrutiny.

    An acceptance here is an administrative decision recorded against simulated
    evidence in this prototype; it is not a real-world authenticity assurance.
    """
    principal.require("fdr:review")
    fdr = load_scoped_fdr(db, principal, fdr_id)

    if payload.expected_version is not None and payload.expected_version != fdr.version:
        raise conflict(
            "This case changed since you opened it. Review the latest version.",
            code="CASE_VERSION_CONFLICT",
        )
    if fdr.submission_status != "SUBMITTED":
        raise conflict("Only a submitted instrument can be scrutinised.")

    transitions = {
        "START_REVIEW": "IN_REVIEW",
        "REQUEST_CLARIFICATION": "CLARIFICATION_REQUIRED",
        "ACCEPT": "ACCEPTED",
        "REJECT": "REJECTED",
        "OBSERVE": fdr.review_status,
    }
    if payload.decision == "START_REVIEW" and fdr.review_status not in {"QUEUED", "IN_REVIEW"}:
        raise conflict(f"Review cannot start from state {fdr.review_status}.")
    if payload.decision in {"ACCEPT", "REJECT"} and fdr.review_status not in {
        "IN_REVIEW",
        "CLARIFICATION_REQUIRED",
        "QUEUED",
    }:
        raise conflict(f"A decision cannot be recorded from state {fdr.review_status}.")

    old_review_status = fdr.review_status
    fdr.review_status = transitions[payload.decision]
    if payload.decision == "START_REVIEW":
        fdr.assigned_officer_id = principal.user_id
    if payload.decision == "REQUEST_CLARIFICATION":
        fdr.submission_status = "CORRECTION_REQUESTED"
    if payload.decision == "REJECT":
        fdr.instrument_status = "REGISTERED"
    fdr.version += 1

    db.add(
        ReviewDecision(
            id=new_id(),
            fdr_id=fdr.id,
            actor_id=principal.user_id,
            decision=payload.decision,
            reason=payload.reason,
            policy_version_id=f"{load_catalog().name}@{load_catalog().version}",
        )
    )

    submitter = db.scalar(select(User).where(User.id == fdr.created_by))
    if submitter and payload.decision in {"REQUEST_CLARIFICATION", "ACCEPT", "REJECT"}:
        titles = {
            "REQUEST_CLARIFICATION": "Clarification requested on your submission",
            "ACCEPT": "Submission accepted for the demo administrative workflow",
            "REJECT": "Submission rejected",
        }
        notify_user(
            db,
            user_id=submitter.id,
            title=titles[payload.decision],
            body=(
                f"Instrument {fdr.fdr_number_masked} ({fdr.issuer_bank}): {payload.reason}"
            ),
            category="ACTION_REQUIRED" if payload.decision != "ACCEPT" else "INFORMATION",
            dedupe_key=f"SCRUTINY:{fdr.id}:{fdr.version}:{payload.decision}",
            fdr_id=fdr.id,
            event_type=f"SCRUTINY_{payload.decision}",
        )

    sync_findings(db, fdr)
    record_audit(
        db,
        aggregate_type="fdr",
        aggregate_id=fdr.id,
        action=f"fdr.scrutiny.{payload.decision.lower()}",
        actor=principal,
        old_state={"review_status": old_review_status},
        new_state={"review_status": fdr.review_status, "version": fdr.version},
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    enqueue_outbox(
        db,
        event_type="fdr.scrutiny_recorded",
        aggregate_type="fdr",
        aggregate_id=fdr.id,
        payload={"decision": payload.decision},
    )
    db.commit()
    return service.to_detail(db, principal, fdr)


@router.post(
    "/fdrs/{fdr_id}/replacements",
    response_model=schemas.FdrDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_replacement(
    fdr_id: str,
    payload: schemas.ReplacementIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Link a successor instrument.

    The predecessor keeps its dates, amount, documents and check history; a
    replacement never rewrites the original record.
    """
    principal.require("replacement:create")
    predecessor = load_scoped_fdr(db, principal, fdr_id)
    if predecessor.instrument_status in {"SUPERSEDED", "ARCHIVED"}:
        raise conflict("This instrument has already been superseded.")

    institution = db.get(Institution, predecessor.institution_id)
    if institution is None:
        raise not_found()

    successor = Fdr(
        id=new_id(),
        institution_id=institution.id,
        created_by=principal.user_id,
        issuer_bank=payload.successor.issuer_bank.strip(),
        branch=payload.successor.branch,
        ifsc=payload.successor.ifsc,
        fdr_number_masked=mask_fdr_number(payload.successor.fdr_number),
        fdr_number_ciphertext=obfuscate_store(payload.successor.fdr_number.strip()),
        fdr_lookup_hash=lookup_hash(
            payload.successor.issuer_bank, payload.successor.fdr_number
        ),
        principal_amount=payload.successor.principal_amount,
        interest_rate=payload.successor.interest_rate,
        issue_date=payload.successor.issue_date,
        maturity_date=payload.successor.maturity_date,
        lien_beneficiary=payload.successor.lien_beneficiary,
        submission_status="DRAFT",
        document_processing_status="NOT_UPLOADED",
        review_status="NOT_SUBMITTED",
        instrument_status="REGISTERED",
        lien_status="CLAIMED" if payload.successor.lien_beneficiary else "UNKNOWN",
    )
    db.add(successor)
    db.flush()

    db.add(
        FdrLink(
            id=new_id(),
            predecessor_fdr_id=predecessor.id,
            successor_fdr_id=successor.id,
            relationship_type=payload.relationship_type,
            effective_date=payload.effective_date,
            reason=payload.reason,
            recorded_by=principal.user_id,
        )
    )
    predecessor.instrument_status = "SUPERSEDED"
    predecessor.version += 1
    sync_findings(db, predecessor)

    record_audit(
        db,
        aggregate_type="fdr",
        aggregate_id=predecessor.id,
        action="fdr.replacement_linked",
        actor=principal,
        old_state={"instrument_status": "ACTIVE"},
        new_state={
            "instrument_status": predecessor.instrument_status,
            "successor_fdr_id": successor.id,
            "relationship_type": payload.relationship_type,
        },
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    db.commit()
    return service.to_detail(db, principal, successor)


@router.get("/fdrs/{fdr_id}/verification-checks", response_model=list[schemas.VerificationCheckOut])
def list_checks(fdr_id: str, principal: CurrentPrincipal, db: DbSession):
    principal.require("fdr:read")
    fdr = load_scoped_fdr(db, principal, fdr_id)
    from app.db.models import VerificationCheck

    checks = db.scalars(
        select(VerificationCheck)
        .where(VerificationCheck.fdr_id == fdr.id)
        .order_by(VerificationCheck.performed_at.desc())
    )
    return [service.to_check_out(check) for check in checks]


@router.post("/findings/{finding_id}/disposition", response_model=schemas.FindingOut)
def dispose_finding(
    finding_id: str,
    payload: schemas.FindingDispositionIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("finding:dispose")
    finding = db.get(Finding, finding_id)
    if finding is None:
        raise not_found()
    load_scoped_fdr(db, principal, finding.fdr_id)

    old_status = finding.status
    finding.status = payload.status
    finding.disposition_reason = payload.reason
    finding.disposed_by = principal.user_id
    record_audit(
        db,
        aggregate_type="finding",
        aggregate_id=finding.id,
        action="finding.disposition",
        actor=principal,
        old_state={"status": old_status},
        new_state={"status": finding.status, "rule_id": finding.rule_id},
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    db.commit()
    return service.to_finding_out(finding)
