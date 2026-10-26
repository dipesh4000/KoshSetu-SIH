"""Presentation and transition services for instruments."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api import schemas
from app.core.authorization import Principal
from app.db.models import (
    Fdr,
    FdrDocument,
    FdrExtraction,
    FdrLink,
    Finding,
    Institution,
    ReleaseRequest,
    ReviewDecision,
    User,
    VerificationCheck,
)
from app.domains.risk.engine import attention_level

VIEWABLE_SCAN_STATES = {"CLEAN"}

COMPARABLE_FIELDS = (
    ("fdr_number", "FDR number"),
    ("principal_amount", "Principal amount"),
    ("issue_date", "Issue date"),
    ("maturity_date", "Maturity date"),
    ("issuer_bank", "Issuer bank"),
    ("lien_beneficiary", "Lien beneficiary"),
)


def today() -> date:
    return datetime.now(timezone.utc).date()


def days_remaining(fdr: Fdr, *, as_of: date | None = None) -> int:
    return (fdr.maturity_date - (as_of or today())).days


def latest_extraction(db: Session, fdr_id: str) -> FdrExtraction | None:
    document_ids = list(
        db.scalars(
            select(FdrDocument.id).where(
                FdrDocument.fdr_id == fdr_id, FdrDocument.scan_status == "CLEAN"
            )
        )
    )
    if not document_ids:
        return None
    return db.scalar(
        select(FdrExtraction)
        .where(FdrExtraction.document_id.in_(document_ids))
        .order_by(FdrExtraction.created_at.desc())
        .limit(1)
    )


def _declared_value(fdr: Fdr, field: str) -> str | None:
    if field == "fdr_number":
        return fdr.fdr_number_masked
    if field == "principal_amount":
        return f"{Decimal(fdr.principal_amount):.2f}"
    if field == "issue_date":
        return fdr.issue_date.isoformat()
    if field == "maturity_date":
        return fdr.maturity_date.isoformat()
    if field == "issuer_bank":
        return fdr.issuer_bank
    if field == "lien_beneficiary":
        return fdr.lien_beneficiary
    return None


def evidence_fields(db: Session, fdr: Fdr) -> list[schemas.ExtractedFieldOut]:
    """Side-by-side evidence: what was declared, what the document says.

    The FDR number is never compared in the clear here; only the masked form is
    shown, and the comparison is reported as NOT_COMPARABLE.
    """
    extraction = latest_extraction(db, fdr.id)
    extracted: dict[str, Any] = {}
    confidence: dict[str, float] = {}
    provenance: dict[str, Any] = {}
    if extraction:
        extracted = json.loads(extraction.extracted_json)
        confidence = json.loads(extraction.confidence_json)
        provenance = json.loads(extraction.bbox_json)

    output: list[schemas.ExtractedFieldOut] = []
    for field, _label in COMPARABLE_FIELDS:
        declared = _declared_value(fdr, field)
        extracted_value = extracted.get(field)
        field_provenance = provenance.get(field) or {}
        if field == "fdr_number":
            difference = "NOT_COMPARABLE"
        elif extracted_value is None:
            difference = "NOT_FOUND"
        elif declared is None:
            difference = "NOT_COMPARABLE"
        elif str(extracted_value).strip().lower() == str(declared).strip().lower():
            difference = "MATCH"
        else:
            difference = "DIFFERS"
        raw = field_provenance.get("source_text")
        if field == "fdr_number":
            # The parsed line contains the number in the clear; only the
            # masked form may leave the server.
            raw = "[masked]" if raw else None
        output.append(
            schemas.ExtractedFieldOut(
                field=field,
                declared_value=declared,
                extracted_value=None if field == "fdr_number" else extracted_value,
                extracted_raw=raw,
                confidence=float(confidence.get(field, 0.0)),
                page_index=field_provenance.get("page_index"),
                bbox=field_provenance.get("bbox"),
                difference=difference,
            )
        )
    return output


def open_finding_severities(db: Session, fdr_id: str) -> list[str]:
    return list(
        db.scalars(
            select(Finding.severity).where(Finding.fdr_id == fdr_id, Finding.status == "OPEN")
        )
    )


def to_list_item(db: Session, fdr: Fdr, *, as_of: date | None = None) -> schemas.FdrListItem:
    institution = db.get(Institution, fdr.institution_id)
    severities = open_finding_severities(db, fdr.id)
    remaining = days_remaining(fdr, as_of=as_of)
    return schemas.FdrListItem(
        id=fdr.id,
        institution_id=fdr.institution_id,
        institution_name=institution.name if institution else "",
        aicte_id=institution.aicte_id if institution else "",
        region_code=institution.region_code if institution else "",
        issuer_bank=fdr.issuer_bank,
        fdr_number_masked=fdr.fdr_number_masked,
        principal_amount=f"{Decimal(fdr.principal_amount):.2f}",
        currency=fdr.currency,
        issue_date=fdr.issue_date,
        maturity_date=fdr.maturity_date,
        days_remaining=remaining,
        is_maturing=0 <= remaining <= 30,
        status=schemas.StatusBlock(
            submission_status=fdr.submission_status,
            document_processing_status=fdr.document_processing_status,
            bank_verification_status=fdr.bank_verification_status,
            review_status=fdr.review_status,
            instrument_status=fdr.instrument_status,
            lien_status=fdr.lien_status,
        ),
        assigned_officer_id=fdr.assigned_officer_id,
        attention_level=attention_level(severities),
        open_finding_count=len(severities),
        version=fdr.version,
        updated_at=fdr.updated_at,
    )


def _actor_label(db: Session, user_id: str | None) -> str:
    if not user_id:
        return "system"
    user = db.get(User, user_id)
    return f"{user.display_name} <{user.email}>" if user else user_id


def to_check_out(check: VerificationCheck) -> schemas.VerificationCheckOut:
    detail = json.loads(check.detail_json or "{}")
    note = (
        "Simulated bank response. Demonstration only; this is not independent "
        "bank authentication and does not replace officer review."
        if check.source_kind == "MOCK_BANK"
        else "Deterministic check performed by the portal against submitted evidence."
    )
    return schemas.VerificationCheckOut(
        id=check.id,
        check_type=check.check_type,
        source_kind=check.source_kind,
        scenario_id=check.scenario_id,
        result=check.result,
        is_simulated=check.is_simulated,
        message=detail.get("message"),
        match_results=detail.get("match_results", {}) or {},
        lien_claim=detail.get("lien_claim"),
        response_hash=check.response_hash,
        correlation_id=detail.get("correlation_id"),
        performed_at=check.performed_at,
        expires_at=check.expires_at,
        provenance_note=note,
    )


def to_finding_out(
    finding: Finding, *, institution_name: str | None = None, masked: str | None = None
) -> schemas.FindingOut:
    return schemas.FindingOut(
        id=finding.id,
        fdr_id=finding.fdr_id,
        rule_id=finding.rule_id,
        rule_version=finding.rule_version,
        category=finding.category,
        severity=finding.severity,
        title=finding.title,
        explanation=finding.explanation,
        recommended_action=finding.recommended_action,
        evidence=json.loads(finding.evidence_json or "{}"),
        status=finding.status,
        disposition_reason=finding.disposition_reason,
        detected_at=finding.detected_at,
        institution_name=institution_name,
        fdr_number_masked=masked,
    )


def permitted_actions(principal: Principal, fdr: Fdr) -> list[str]:
    """Actions the server would currently allow. The UI mirrors this list."""
    actions: list[str] = []
    if principal.has("fdr:draft") and fdr.submission_status in {"DRAFT", "CORRECTION_REQUESTED"}:
        actions += ["EDIT_DRAFT", "UPLOAD_DOCUMENT"]
    if principal.has("fdr:submit") and fdr.submission_status in {
        "DRAFT",
        "UPLOADED",
        "CORRECTION_REQUESTED",
    }:
        actions.append("SUBMIT")
    if principal.has("fdr:review") and fdr.submission_status == "SUBMITTED":
        if fdr.review_status in {"QUEUED", "NOT_SUBMITTED"}:
            actions.append("START_REVIEW")
        if fdr.review_status in {"IN_REVIEW", "CLARIFICATION_REQUIRED", "QUEUED"}:
            actions += ["REQUEST_CLARIFICATION", "ACCEPT", "REJECT", "OBSERVE"]
    if principal.has("verification:mock_bank") and fdr.submission_status == "SUBMITTED":
        actions.append("RUN_BANK_SIMULATION")
    if principal.has("document:reparse"):
        actions.append("REPARSE_DOCUMENT")
    if principal.has("release:request") and fdr.review_status == "ACCEPTED":
        actions.append("REQUEST_RELEASE")
    if principal.has("replacement:create") and fdr.instrument_status in {"REGISTERED", "ACTIVE"}:
        actions.append("RECORD_REPLACEMENT")
    return actions


def to_detail(db: Session, principal: Principal, fdr: Fdr) -> schemas.FdrDetailOut:
    institution = db.get(Institution, fdr.institution_id)
    documents = list(
        db.scalars(
            select(FdrDocument)
            .where(FdrDocument.fdr_id == fdr.id)
            .order_by(FdrDocument.created_at.desc())
        )
    )
    checks = list(
        db.scalars(
            select(VerificationCheck)
            .where(VerificationCheck.fdr_id == fdr.id)
            .order_by(VerificationCheck.performed_at.desc())
        )
    )
    findings = list(
        db.scalars(
            select(Finding)
            .where(Finding.fdr_id == fdr.id)
            .order_by(Finding.status, Finding.detected_at.desc())
        )
    )
    decisions = list(
        db.scalars(
            select(ReviewDecision)
            .where(ReviewDecision.fdr_id == fdr.id)
            .order_by(ReviewDecision.created_at.desc())
        )
    )
    links = list(
        db.scalars(
            select(FdrLink).where(
                (FdrLink.predecessor_fdr_id == fdr.id) | (FdrLink.successor_fdr_id == fdr.id)
            )
        )
    )
    release = db.scalar(
        select(ReleaseRequest)
        .where(ReleaseRequest.fdr_id == fdr.id)
        .order_by(ReleaseRequest.created_at.desc())
        .limit(1)
    )

    link_out: list[schemas.LinkOut] = []
    for link in links:
        predecessor = db.get(Fdr, link.predecessor_fdr_id)
        successor = db.get(Fdr, link.successor_fdr_id)
        link_out.append(
            schemas.LinkOut(
                id=link.id,
                relationship_type=link.relationship_type,
                effective_date=link.effective_date,
                reason=link.reason,
                predecessor_fdr_id=link.predecessor_fdr_id,
                successor_fdr_id=link.successor_fdr_id,
                predecessor_masked=predecessor.fdr_number_masked if predecessor else "",
                successor_masked=successor.fdr_number_masked if successor else "",
            )
        )

    return schemas.FdrDetailOut(
        id=fdr.id,
        institution=schemas.InstitutionOut.model_validate(institution),
        issuer_bank=fdr.issuer_bank,
        branch=fdr.branch,
        ifsc=fdr.ifsc,
        fdr_number_masked=fdr.fdr_number_masked,
        principal_amount=f"{Decimal(fdr.principal_amount):.2f}",
        currency=fdr.currency,
        interest_rate=None if fdr.interest_rate is None else f"{Decimal(fdr.interest_rate):.2f}",
        issue_date=fdr.issue_date,
        maturity_date=fdr.maturity_date,
        days_remaining=days_remaining(fdr),
        lien_beneficiary=fdr.lien_beneficiary,
        status=schemas.StatusBlock(
            submission_status=fdr.submission_status,
            document_processing_status=fdr.document_processing_status,
            bank_verification_status=fdr.bank_verification_status,
            review_status=fdr.review_status,
            instrument_status=fdr.instrument_status,
            lien_status=fdr.lien_status,
        ),
        assigned_officer_id=fdr.assigned_officer_id,
        version=fdr.version,
        attention_level=attention_level(open_finding_severities(db, fdr.id)),
        created_at=fdr.created_at,
        updated_at=fdr.updated_at,
        evidence_fields=evidence_fields(db, fdr),
        documents=[
            schemas.DocumentOut(
                id=document.id,
                document_type=document.document_type,
                original_filename=document.original_filename,
                content_type=document.content_type,
                size_bytes=document.size_bytes,
                sha256=document.sha256,
                scan_status=document.scan_status,
                scan_detail=document.scan_detail,
                processing_status=document.processing_status,
                version=document.version,
                uploaded_at=document.created_at,
                is_viewable=document.scan_status in VIEWABLE_SCAN_STATES,
            )
            for document in documents
        ],
        verification_checks=[to_check_out(check) for check in checks],
        findings=[
            to_finding_out(
                finding,
                institution_name=institution.name if institution else None,
                masked=fdr.fdr_number_masked,
            )
            for finding in findings
        ],
        review_decisions=[
            schemas.ReviewDecisionOut(
                id=decision.id,
                decision=decision.decision,
                reason=decision.reason,
                actor_label=_actor_label(db, decision.actor_id),
                created_at=decision.created_at,
            )
            for decision in decisions
        ],
        links=link_out,
        release_request_id=release.id if release else None,
        permitted_actions=permitted_actions(principal, fdr),
    )


def institution_totals(db: Session, institution_ids: list[str]) -> dict[str, Any]:
    statement = select(
        func.count(Fdr.id), func.coalesce(func.sum(Fdr.principal_amount), 0)
    ).where(Fdr.institution_id.in_(institution_ids))
    count, total = db.execute(statement).one()
    return {"count": count, "total": Decimal(total or 0)}
