"""Bank verification routes.

Only the simulator exists in this project. Its provenance is enforced here, not
in the UI: the stored check always carries source_kind=MOCK_BANK, is_simulated
and the scenario id, and no simulated result changes an officer decision.
"""

from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, status

from app.api import schemas
from app.api.deps import CurrentPrincipal, DbSession, load_scoped_fdr, request_id_of
from app.core.config import settings
from app.db.base import new_id
from app.db.models import VerificationCheck
from app.domains.audit.service import enqueue_outbox, record_audit
from app.domains.bank.mock_adapter import SCENARIOS, MockBankUnavailable, get_verifier
from app.domains.bank.ports import BankOutcome, InstrumentClaim
from app.core.security import deobfuscate_store
from app.domains.fdr import service
from app.domains.risk.engine import sync_findings

router = APIRouter(tags=["verification"])

OUTCOME_TO_STATUS = {
    BankOutcome.MOCK_MATCH: "MOCK_MATCH",
    BankOutcome.MOCK_MISMATCH: "MOCK_MISMATCH",
    BankOutcome.MOCK_NOT_FOUND: "MOCK_MISMATCH",
    BankOutcome.MOCK_TIMEOUT: "MOCK_ERROR",
    BankOutcome.MOCK_SERVICE_ERROR: "MOCK_ERROR",
}


@router.get("/verification/scenarios")
def list_scenarios(principal: CurrentPrincipal):
    """Fixture catalogue for the demonstration. Officials only."""
    principal.require("verification:mock_bank")
    return {
        "provider": "MOCK_BANK",
        "environment": settings.environment,
        "is_simulated": True,
        "disclaimer": (
            "These scenarios drive a simulator. A simulated outcome is never "
            "independent bank authentication."
        ),
        "scenarios": [
            {
                "id": key,
                "expected_outcome": value["outcome"],
                "description": value["message"],
            }
            for key, value in SCENARIOS.items()
        ],
    }


@router.post(
    "/fdrs/{fdr_id}/mock-bank-check", response_model=schemas.VerificationCheckOut
)
def run_mock_bank_check(
    fdr_id: str,
    payload: schemas.MockBankIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("verification:mock_bank")
    fdr = load_scoped_fdr(db, principal, fdr_id)
    if fdr.submission_status != "SUBMITTED":
        from app.core.authorization import conflict

        raise conflict(
            "Run verification only after the institution has submitted the instrument."
        )

    correlation_id = f"corr-{uuid4()}"
    claim = InstrumentClaim(
        fdr_number=deobfuscate_store(fdr.fdr_number_ciphertext),
        issuer_bank=fdr.issuer_bank,
        principal_amount=f"{fdr.principal_amount:.2f}",
        issue_date=fdr.issue_date.isoformat(),
        maturity_date=fdr.maturity_date.isoformat(),
        lien_beneficiary=fdr.lien_beneficiary,
    )

    try:
        result = get_verifier().verify(
            instrument_ref=fdr.id,
            claim=claim,
            requested_checks=payload.checks,
            correlation_id=correlation_id,
            scenario_id=payload.scenario_id,
        )
    except MockBankUnavailable as exc:
        record_audit(
            db,
            aggregate_type="fdr",
            aggregate_id=fdr.id,
            action="verification.mock_bank_unavailable",
            actor=principal,
            outcome="DENY",
            reason=str(exc),
            request_id=request_id_of(request),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DEPENDENCY_UNAVAILABLE", "message": str(exc)},
        ) from exc
    except ValueError as exc:
        from app.core.authorization import invalid

        raise invalid(str(exc)) from exc

    from app.db.models import BankResponseReceipt
    from app.db.locking import transaction_lock

    transaction_lock(db, "bank-response-replay")
    rejected_reason = result.detail.get("rejected_reason")
    if db.get(BankResponseReceipt, result.response_id):
        rejected_reason = "RESPONSE_REPLAYED"
    elif not rejected_reason:
        db.add(
            BankResponseReceipt(id=result.response_id, received_at=result.checked_at)
        )
    stored_result = (
        "REJECTED_BY_PORTAL"
        if rejected_reason
        else OUTCOME_TO_STATUS[result.verification_status]
    )
    detail = {
        "message": result.message,
        "match_results": result.match_results,
        "lien_claim": result.lien_claim,
        "correlation_id": correlation_id,
        "signature_valid": result.signature_valid,
        "environment": result.environment,
        "response_id": result.response_id,
        **({"rejected_reason": rejected_reason} if rejected_reason else {}),
        **{k: v for k, v in result.detail.items() if k != "rejected_reason"},
    }

    check = VerificationCheck(
        id=new_id(),
        fdr_id=fdr.id,
        check_type="BANK_FIELD_MATCH",
        source_kind=result.source_kind.value,
        scenario_id=result.scenario_id,
        result=stored_result,
        detail_json=json.dumps(detail, sort_keys=True, default=str),
        source_ref=result.response_id,
        response_hash=result.evidence_hash,
        is_simulated=True,
        performed_by=principal.user_id,
        performed_at=result.checked_at,
        expires_at=result.expires_at,
    )
    db.add(check)

    if rejected_reason:
        # A tampered or replayed response changes no state; it raises a
        # security event instead.
        record_audit(
            db,
            aggregate_type="fdr",
            aggregate_id=fdr.id,
            action="verification.mock_response_rejected",
            actor=principal,
            outcome="DENY",
            new_state={"scenario_id": result.scenario_id, "reason": rejected_reason},
            reason=result.message,
            request_id=request_id_of(request),
        )
        enqueue_outbox(
            db,
            event_type="security.mock_response_rejected",
            aggregate_type="fdr",
            aggregate_id=fdr.id,
            payload={"reason": rejected_reason, "scenario_id": result.scenario_id},
        )
    else:
        old_status = fdr.bank_verification_status
        fdr.bank_verification_status = stored_result
        if result.lien_claim and result.lien_claim.startswith("ACTIVE"):
            # A simulated lien claim is recorded as claimed, never confirmed.
            fdr.lien_status = "CLAIMED"
        elif result.lien_claim and result.lien_claim.startswith("NOT_CONFIRMED"):
            fdr.lien_status = "DISPUTED"
        fdr.version += 1
        record_audit(
            db,
            aggregate_type="fdr",
            aggregate_id=fdr.id,
            action="verification.mock_bank_check",
            actor=principal,
            old_state={"bank_verification_status": old_status},
            new_state={
                "bank_verification_status": fdr.bank_verification_status,
                "scenario_id": result.scenario_id,
                "source_kind": result.source_kind.value,
                "is_simulated": True,
            },
            reason="Simulated bank verification; officer review remains separate",
            request_id=request_id_of(request),
        )

    sync_findings(db, fdr)
    db.commit()
    return service.to_check_out(check)
