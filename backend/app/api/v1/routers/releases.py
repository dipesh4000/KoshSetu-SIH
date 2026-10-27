"""Release/refund case routes.

The portal records an administrative release decision. It does not move money,
and APPROVED is kept distinct from any bank-side discharge, which this platform
may never learn about.
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import CurrentPrincipal, DbSession, load_scoped_fdr, request_id_of
from app.core.authorization import Principal, conflict, invalid, not_found
from app.db.base import new_id, utcnow
from app.db.models import (
    ApprovalDecision,
    ClearanceDecision,
    ClearanceRequirement,
    CommandReceipt,
    Fdr,
    FdrDocument,
    Institution,
    ReleaseDocument,
    ReleaseRequest,
    User,
)
from app.domains.audit.service import enqueue_outbox, record_audit
from app.domains.notifications.scheduler import notify_user
from app.domains.release.policy import available_bases, load_policy
from app.domains.risk.engine import sync_findings

router = APIRouter(tags=["releases"])

IdempotencyKey = Annotated[str | None, Header(alias="Idempotency-Key")]

FINAL_READY_STATES = {"READY_FOR_DECISION"}


@router.get("/release-policy")
def get_release_policy(principal: CurrentPrincipal):
    principal.require("release:read")
    policy = load_policy()
    return {
        "checklist_name": policy.name,
        "version": policy.version,
        "sha256": policy.sha256,
        "effective_from": policy.effective_from.isoformat(),
        "bases": available_bases(),
        "note": (
            "Clearance bodies and documents are configurable workflow steps modelled on "
            "publicly described AICTE practice. The applicable handbook year and case type "
            "must be confirmed by the policy owner."
        ),
    }


def _scoped_requests(principal: Principal):
    statement = select(ReleaseRequest)
    if principal.is_official and principal.has("release:read"):
        from app.api.deps import scoped_fdr_query

        return statement.where(
            ReleaseRequest.fdr_id.in_(
                scoped_fdr_query(principal).with_only_columns(Fdr.id)
            )
        )
    if principal.institution_ids:
        return statement.where(
            ReleaseRequest.institution_id.in_(principal.institution_ids)
        )
    return statement.where(ReleaseRequest.id == "__no_scope__")


def _checklist(
    db: Session, request_row: ReleaseRequest
) -> list[schemas.ReleaseChecklistItem]:
    policy = load_policy()
    basis = policy.basis(request_row.basis_code)
    attached = {
        row.document_type: row.document_id
        for row in db.scalars(
            select(ReleaseDocument).where(ReleaseDocument.request_id == request_row.id)
        )
    }
    return [
        schemas.ReleaseChecklistItem(
            code=code,
            label=policy.documents.get(code, code),
            satisfied=code in attached,
            document_id=attached.get(code),
        )
        for code in basis["required_documents"]
    ]


def _clearance_out(
    db: Session, requirement: ClearanceRequirement
) -> schemas.ClearanceOut:
    decision = db.scalar(
        select(ClearanceDecision)
        .where(ClearanceDecision.requirement_id == requirement.id)
        .order_by(ClearanceDecision.decided_at.desc())
        .limit(1)
    )
    actor_label = None
    if decision:
        user = db.get(User, decision.actor_id)
        actor_label = (
            f"{user.display_name} <{user.email}>" if user else decision.actor_id
        )
    return schemas.ClearanceOut(
        id=requirement.id,
        bureau_code=requirement.bureau_code,
        bureau_name=requirement.bureau_name,
        required=requirement.required,
        state=requirement.state,
        requirement_version=requirement.requirement_version,
        outcome=decision.outcome if decision else None,
        reason=decision.reason if decision else None,
        decided_by=actor_label,
        decided_at=decision.decided_at if decision else None,
        valid_until=decision.valid_until if decision else None,
    )


def blocking_reasons(
    db: Session, request_row: ReleaseRequest, *, checker: Principal | None = None
) -> list[str]:
    """Every condition that currently prevents a final approval."""
    reasons: list[str] = []
    fdr = db.get(Fdr, request_row.fdr_id)

    if request_row.status in {"APPROVED", "REJECTED", "CLOSED"}:
        reasons.append(f"The case is already {request_row.status}.")
    if request_row.hold_reason:
        reasons.append(f"The case is on hold: {request_row.hold_reason}")

    pending = [
        requirement.bureau_code
        for requirement in db.scalars(
            select(ClearanceRequirement).where(
                ClearanceRequirement.request_id == request_row.id,
                ClearanceRequirement.required.is_(True),
                ClearanceRequirement.state != "CLEARED",
            )
        )
    ]
    if pending:
        reasons.append(f"Required clearance pending: {', '.join(sorted(pending))}.")

    missing_documents = [
        item.code for item in _checklist(db, request_row) if not item.satisfied
    ]
    if missing_documents:
        reasons.append(f"Prescribed document missing: {', '.join(missing_documents)}.")

    if fdr is None or fdr.review_status != "ACCEPTED":
        reasons.append("Scrutiny has not accepted the instrument.")
    if request_row.status not in FINAL_READY_STATES and not reasons:
        reasons.append(
            f"The case must reach READY_FOR_DECISION before approval (now {request_row.status})."
        )
    if checker is not None:
        if not checker.has("release:approve"):
            reasons.append("You are not a designated final approver for this case.")
        if request_row.prepared_by == checker.user_id:
            reasons.append(
                "The officer who prepared the case cannot be its final approver."
            )
        if request_row.requested_by == checker.user_id:
            reasons.append("The requester cannot approve their own release request.")
    return reasons


def _to_out(
    db: Session, request_row: ReleaseRequest, principal: Principal
) -> schemas.ReleaseRequestOut:
    policy = load_policy()
    fdr = db.get(Fdr, request_row.fdr_id)
    institution = db.get(Institution, request_row.institution_id)
    requester = db.get(User, request_row.requested_by)
    approvals = [
        schemas.ApprovalOut(
            id=row.id,
            stage=row.stage,
            outcome=row.outcome,
            reason=row.reason,
            actor_label=(
                lambda user: f"{user.display_name} <{user.email}>"
                if user
                else row.actor_id
            )(db.get(User, row.actor_id)),
            decided_at=row.decided_at,
        )
        for row in db.scalars(
            select(ApprovalDecision)
            .where(ApprovalDecision.request_id == request_row.id)
            .order_by(ApprovalDecision.decided_at)
        )
    ]
    reasons = blocking_reasons(db, request_row, checker=principal)
    return schemas.ReleaseRequestOut(
        id=request_row.id,
        fdr_id=request_row.fdr_id,
        fdr_number_masked=fdr.fdr_number_masked if fdr else "",
        institution_id=request_row.institution_id,
        institution_name=institution.name if institution else "",
        basis_code=request_row.basis_code,
        basis_label=policy.bases.get(request_row.basis_code, {}).get(
            "label", request_row.basis_code
        ),
        justification=request_row.justification,
        status=request_row.status,
        hold_reason=request_row.hold_reason,
        policy_version=request_row.policy_version_id or policy.version,
        version=request_row.version,
        requested_by_label=(
            f"{requester.display_name} <{requester.email}>"
            if requester
            else request_row.requested_by
        ),
        prepared_by=request_row.prepared_by,
        approved_by=request_row.approved_by,
        created_at=request_row.created_at,
        decided_at=request_row.decided_at,
        clearances=[
            _clearance_out(db, requirement)
            for requirement in db.scalars(
                select(ClearanceRequirement)
                .where(ClearanceRequirement.request_id == request_row.id)
                .order_by(ClearanceRequirement.bureau_code)
            )
        ],
        checklist=_checklist(db, request_row),
        approvals=approvals,
        blocking_reasons=reasons,
        can_finally_approve=not reasons,
        principal_amount=f"{Decimal(fdr.principal_amount):.2f}" if fdr else "0.00",
        maturity_date=fdr.maturity_date if fdr else request_row.created_at.date(),
    )


@router.get("/release-requests", response_model=list[schemas.ReleaseRequestOut])
def list_requests(
    principal: CurrentPrincipal,
    db: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    assigned_bureau: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    principal.require("release:read")
    statement = _scoped_requests(principal)
    if status_filter:
        statement = statement.where(ReleaseRequest.status == status_filter)
    if assigned_bureau:
        statement = statement.join(
            ClearanceRequirement, ClearanceRequirement.request_id == ReleaseRequest.id
        ).where(ClearanceRequirement.bureau_code == assigned_bureau)
    rows = db.scalars(statement.order_by(ReleaseRequest.created_at.desc()).limit(limit))
    return [_to_out(db, row, principal) for row in rows]


@router.post(
    "/release-requests",
    response_model=schemas.ReleaseRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    payload: schemas.ReleaseRequestIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("release:request")
    fdr = load_scoped_fdr(db, principal, payload.fdr_id)
    policy = load_policy()
    try:
        basis = policy.basis(payload.basis_code)
    except KeyError:
        raise invalid(f"Unknown release basis: {payload.basis_code}") from None

    existing = db.scalar(
        select(ReleaseRequest).where(
            ReleaseRequest.fdr_id == fdr.id,
            ReleaseRequest.status.notin_(["CLOSED", "REJECTED"]),
        )
    )
    if existing:
        raise conflict("An active release request already exists for this instrument.")

    request_row = ReleaseRequest(
        id=new_id(),
        fdr_id=fdr.id,
        institution_id=fdr.institution_id,
        requested_by=principal.user_id,
        basis_code=payload.basis_code,
        justification=payload.justification,
        status="REQUESTED",
        policy_version_id=f"{policy.name}@{policy.version}+{policy.sha256[:8]}",
    )
    db.add(request_row)
    db.flush()

    # Clearances are instantiated from the policy in force right now, so a
    # later catalogue edit cannot change this open case.
    for bureau_code in basis["clearances"]:
        db.add(
            ClearanceRequirement(
                id=new_id(),
                request_id=request_row.id,
                bureau_code=bureau_code,
                bureau_name=policy.bureau_name(bureau_code),
                requirement_version=policy.version,
                required=True,
                state="PENDING",
            )
        )

    attached = 0
    for document_id in payload.document_ids:
        document = db.get(FdrDocument, document_id)
        if (
            document is None
            or document.fdr_id != fdr.id
            or document.scan_status != "CLEAN"
        ):
            continue
        db.add(
            ReleaseDocument(
                id=new_id(),
                request_id=request_row.id,
                document_id=document.id,
                document_type=document.document_type,
                checklist_version=policy.version,
            )
        )
        attached += 1

    request_row.status = (
        "DOCUMENTS_PENDING"
        if attached < len(basis["required_documents"])
        else "CLEARANCES_PENDING"
    )
    sync_findings(db, fdr)
    record_audit(
        db,
        aggregate_type="release_request",
        aggregate_id=request_row.id,
        action="release.requested",
        actor=principal,
        new_state={
            "fdr_id": fdr.id,
            "basis_code": payload.basis_code,
            "status": request_row.status,
            "clearances": basis["clearances"],
        },
        reason=payload.justification,
        request_id=request_id_of(request),
    )
    enqueue_outbox(
        db,
        event_type="release.requested",
        aggregate_type="release_request",
        aggregate_id=request_row.id,
        payload={"institution_id": fdr.institution_id},
    )
    db.commit()
    return _to_out(db, request_row, principal)


def _load_scoped_request(
    db: Session, principal: Principal, request_id: str
) -> ReleaseRequest:
    row = db.scalar(
        _scoped_requests(principal)
        .where(ReleaseRequest.id == request_id)
        .with_for_update()
    )
    if row is None:
        raise not_found()
    return row


@router.get("/release-requests/{request_id}", response_model=schemas.ReleaseRequestOut)
def get_request(request_id: str, principal: CurrentPrincipal, db: DbSession):
    principal.require("release:read")
    return _to_out(db, _load_scoped_request(db, principal, request_id), principal)


@router.post(
    "/release-requests/{request_id}/documents/{document_id}",
    response_model=schemas.ReleaseRequestOut,
)
def attach_document(
    request_id: str,
    document_id: str,
    document_type: str,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("release:request")
    request_row = _load_scoped_request(db, principal, request_id)
    policy = load_policy()
    if document_type not in policy.basis(request_row.basis_code)["required_documents"]:
        raise invalid(f"{document_type} is not part of this checklist.")

    document = db.get(FdrDocument, document_id)
    if document is None or document.fdr_id != request_row.fdr_id:
        raise not_found()
    if document.scan_status != "CLEAN":
        raise conflict("Only a document that passed scanning can be attached.")

    already = db.scalar(
        select(ReleaseDocument).where(
            ReleaseDocument.request_id == request_row.id,
            ReleaseDocument.document_type == document_type,
        )
    )
    if already:
        already.document_id = document.id
    else:
        db.add(
            ReleaseDocument(
                id=new_id(),
                request_id=request_row.id,
                document_id=document.id,
                document_type=document_type,
                checklist_version=policy.version,
            )
        )
    db.flush()
    if all(
        item.satisfied for item in _checklist(db, request_row)
    ) and request_row.status in {
        "REQUESTED",
        "DOCUMENTS_PENDING",
    }:
        request_row.status = "CLEARANCES_PENDING"
    record_audit(
        db,
        aggregate_type="release_request",
        aggregate_id=request_row.id,
        action="release.document_attached",
        actor=principal,
        new_state={"document_type": document_type, "status": request_row.status},
        request_id=request_id_of(request),
    )
    db.commit()
    return _to_out(db, request_row, principal)


@router.post(
    "/release-requests/{request_id}/clearances/{bureau_code}/decide",
    response_model=schemas.ReleaseRequestOut,
)
def decide_clearance(
    request_id: str,
    bureau_code: str,
    payload: schemas.ClearanceDecisionIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Record one bureau's decision. Only its assigned officer may do so."""
    principal.require("release:clear")
    request_row = _load_scoped_request(db, principal, request_id)
    requirement = db.scalar(
        select(ClearanceRequirement).where(
            ClearanceRequirement.request_id == request_row.id,
            ClearanceRequirement.bureau_code == bureau_code,
        )
    )
    if requirement is None:
        raise not_found()
    if bureau_code not in principal.bureau_codes:
        from app.core.authorization import Principal as _P  # noqa: F401

        record_audit(
            db,
            aggregate_type="clearance_requirement",
            aggregate_id=requirement.id,
            action="release.clearance_denied",
            actor=principal,
            outcome="DENY",
            reason=f"Not assigned to bureau {bureau_code}",
            request_id=request_id_of(request),
        )
        db.commit()
        principal.require("__bureau_assignment_required__")

    db.add(
        ClearanceDecision(
            id=new_id(),
            requirement_id=requirement.id,
            actor_id=principal.user_id,
            outcome=payload.outcome,
            reason=payload.reason,
            valid_until=payload.valid_until,
            decided_at=utcnow(),
        )
    )
    old_state = requirement.state
    requirement.state = {
        "CLEARED": "CLEARED",
        "OBJECTION": "OBJECTION",
        "CLARIFICATION_REQUIRED": "CLARIFICATION_REQUIRED",
    }[payload.outcome]

    if payload.outcome == "OBJECTION":
        request_row.status = "ON_HOLD"
        request_row.hold_reason = (
            f"{bureau_code} recorded an objection: {payload.reason}"
        )
    else:
        outstanding = db.scalar(
            select(ClearanceRequirement).where(
                ClearanceRequirement.request_id == request_row.id,
                ClearanceRequirement.required.is_(True),
                ClearanceRequirement.state != "CLEARED",
                ClearanceRequirement.id != requirement.id,
            )
        )
        if (
            payload.outcome == "CLEARED"
            and outstanding is None
            and request_row.status
            not in {
                "APPROVED",
                "REJECTED",
                "CLOSED",
            }
        ):
            if all(item.satisfied for item in _checklist(db, request_row)):
                request_row.status = "READY_FOR_DECISION"
                request_row.hold_reason = None

    request_row.version += 1
    fdr = db.get(Fdr, request_row.fdr_id)
    if fdr:
        sync_findings(db, fdr)
    record_audit(
        db,
        aggregate_type="clearance_requirement",
        aggregate_id=requirement.id,
        action="release.clearance_decided",
        actor=principal,
        old_state={"state": old_state},
        new_state={
            "state": requirement.state,
            "request_status": request_row.status,
            "bureau_code": bureau_code,
        },
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    db.commit()
    return _to_out(db, request_row, principal)


@router.post(
    "/release-requests/{request_id}/prepare", response_model=schemas.ReleaseRequestOut
)
def prepare_case(
    request_id: str,
    payload: schemas.ReleaseActionIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Maker step: the preparing officer is recorded and cannot later approve."""
    principal.require("release:prepare")
    request_row = _load_scoped_request(db, principal, request_id)
    if payload.expected_version != request_row.version:
        raise conflict(
            "This case changed since you opened it. Review the latest version.",
            code="CASE_VERSION_CONFLICT",
        )
    if request_row.status in {"APPROVED", "REJECTED", "CLOSED"}:
        raise conflict(f"The case is already {request_row.status}.")

    request_row.prepared_by = principal.user_id
    request_row.version += 1
    db.add(
        ApprovalDecision(
            id=new_id(),
            request_id=request_row.id,
            actor_id=principal.user_id,
            stage="PREPARE",
            outcome="PREPARED",
            reason=payload.reason,
            decided_at=utcnow(),
        )
    )
    record_audit(
        db,
        aggregate_type="release_request",
        aggregate_id=request_row.id,
        action="release.prepared",
        actor=principal,
        new_state={"prepared_by": principal.user_id, "version": request_row.version},
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    db.commit()
    return _to_out(db, request_row, principal)


@router.post(
    "/release-requests/{request_id}/approve", response_model=schemas.ReleaseRequestOut
)
def approve_release(
    request_id: str,
    payload: schemas.ReleaseActionIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
    idempotency_key: IdempotencyKey = None,
):
    """Final approval.

    Everything is re-checked inside the transaction: current authority, the
    version the caller saw, every required clearance, the document checklist,
    holds and maker/checker separation. The result is an administrative
    approval, not a confirmation that a bank released any money.
    """
    principal.require("release:approve")
    request_row = _load_scoped_request(db, principal, request_id)

    if idempotency_key:
        receipt = db.scalar(
            select(CommandReceipt).where(
                CommandReceipt.actor_id == principal.user_id,
                CommandReceipt.idempotency_key == idempotency_key,
            )
        )
        if receipt is not None:
            return schemas.ReleaseRequestOut.model_validate(
                json.loads(receipt.response_json)
            )

    if payload.expected_version != request_row.version:
        raise conflict(
            "This case changed since you opened it. Review the latest version.",
            code="CASE_VERSION_CONFLICT",
        )

    reasons = blocking_reasons(db, request_row, checker=principal)
    if reasons:
        record_audit(
            db,
            aggregate_type="release_request",
            aggregate_id=request_row.id,
            action="release.approve_blocked",
            actor=principal,
            outcome="DENY",
            new_state={"blocking_reasons": reasons},
            reason=payload.reason,
            request_id=request_id_of(request),
        )
        db.commit()
        raise conflict(
            "The request cannot proceed until all currently required clearances and "
            f"conditions are satisfied: {' '.join(reasons)}",
            code="RELEASE_PREREQUISITES_UNMET",
        )

    old_status = request_row.status
    claimed = db.execute(
        update(ReleaseRequest)
        .where(
            ReleaseRequest.id == request_row.id,
            ReleaseRequest.version == payload.expected_version,
            ReleaseRequest.status == "READY_FOR_DECISION",
        )
        .values(version=ReleaseRequest.version + 1)
        .execution_options(synchronize_session=False)
    )
    if claimed.rowcount != 1:
        raise conflict(
            "This case changed since you opened it.", code="CASE_VERSION_CONFLICT"
        )
    request_row.status = "APPROVED"
    request_row.approved_by = principal.user_id
    request_row.decided_at = utcnow()
    request_row.version += 1
    db.add(
        ApprovalDecision(
            id=new_id(),
            request_id=request_row.id,
            actor_id=principal.user_id,
            stage="FINAL",
            outcome="APPROVED",
            reason=payload.reason,
            decided_at=utcnow(),
        )
    )

    fdr = db.get(Fdr, request_row.fdr_id)
    if fdr:
        # RELEASE_RECORDED means the administrative decision is on record. Any
        # actual bank discharge is separate evidence the portal may never see.
        fdr.instrument_status = "RELEASE_RECORDED"
        fdr.version += 1
        sync_findings(db, fdr)

    requester = db.get(User, request_row.requested_by)
    if requester:
        notify_user(
            db,
            user_id=requester.id,
            title="Release request approved",
            body=(
                "The release request has been approved administratively. This is not a "
                "confirmation that the bank has released or refunded any amount."
            ),
            category="INFORMATION",
            dedupe_key=f"RELEASE_APPROVED:{request_row.id}:{request_row.version}",
            fdr_id=request_row.fdr_id,
            release_request_id=request_row.id,
            event_type="RELEASE_APPROVED",
        )

    record_audit(
        db,
        aggregate_type="release_request",
        aggregate_id=request_row.id,
        action="release.approved",
        actor=principal,
        old_state={"status": old_status, "prepared_by": request_row.prepared_by},
        new_state={
            "status": request_row.status,
            "approved_by": principal.user_id,
            "version": request_row.version,
            "note": "REQUEST_APPROVED is not BANK_RELEASE_COMPLETED",
        },
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    enqueue_outbox(
        db,
        event_type="release.approved",
        aggregate_type="release_request",
        aggregate_id=request_row.id,
    )

    response = _to_out(db, request_row, principal)
    if idempotency_key:
        db.add(
            CommandReceipt(
                id=new_id(),
                actor_id=principal.user_id,
                idempotency_key=idempotency_key,
                command="release.approve",
                response_json=response.model_dump_json(),
            )
        )
    db.commit()
    return response


@router.post(
    "/release-requests/{request_id}/reject", response_model=schemas.ReleaseRequestOut
)
def reject_release(
    request_id: str,
    payload: schemas.ReleaseActionIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("release:approve")
    request_row = _load_scoped_request(db, principal, request_id)
    if payload.expected_version != request_row.version:
        raise conflict(
            "This case changed since you opened it. Review the latest version.",
            code="CASE_VERSION_CONFLICT",
        )
    if request_row.status in {"APPROVED", "REJECTED", "CLOSED"}:
        raise conflict(f"The case is already {request_row.status}.")

    old_status = request_row.status
    request_row.status = "REJECTED"
    request_row.approved_by = principal.user_id
    request_row.decided_at = utcnow()
    request_row.version += 1
    db.add(
        ApprovalDecision(
            id=new_id(),
            request_id=request_row.id,
            actor_id=principal.user_id,
            stage="FINAL",
            outcome="REJECTED",
            reason=payload.reason,
            decided_at=utcnow(),
        )
    )
    record_audit(
        db,
        aggregate_type="release_request",
        aggregate_id=request_row.id,
        action="release.rejected",
        actor=principal,
        old_state={"status": old_status},
        new_state={"status": request_row.status},
        reason=payload.reason,
        request_id=request_id_of(request),
    )
    db.commit()
    return _to_out(db, request_row, principal)
