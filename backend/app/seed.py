"""Deterministic synthetic dataset for the SIH demonstration.

Everything here is invented: institutions, officials, instruments, documents,
clearances and bank responses. Nothing corresponds to a real institution, a
real deposit or a real bank record.

Run:  python -m app.seed [--reset]
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    lookup_hash,
    mask_fdr_number,
    obfuscate_store,
    sha256_bytes,
)
from app.db.base import Base, new_id, utcnow
from app.db.models import (
    ClearanceDecision,
    ClearanceRequirement,
    Fdr,
    FdrDocument,
    FdrExtraction,
    FdrLink,
    FdrSubmission,
    Institution,
    PolicyVersion,
    ReleaseDocument,
    ReleaseRequest,
    ReviewDecision,
    RoleAssignment,
    User,
    VerificationCheck,
)
from app.db.session import SessionFactory, engine
from app.domains.audit.service import record_audit
from app.domains.documents import extraction as extraction_engine
from app.domains.documents.sample_pdf import instrument_pdf
from app.domains.documents.scanner import scan
from app.domains.notifications.scheduler import run_maturity_scan
from app.domains.release.policy import load_policy
from app.domains.risk.engine import load_catalog, sync_findings
from app.infrastructure import storage as object_store

DEMO_PASSWORD = "Demo@12345"  # documented demo credential; local use only
TODAY = date.today()


def _user(db: Session, email: str, name: str, *, mfa: bool = False) -> User:
    user = User(
        id=new_id(),
        email=email,
        display_name=name,
        password_hash=hash_password(DEMO_PASSWORD),
        active=True,
        mfa_enrolled=mfa,
    )
    db.add(user)
    return user


def _grant(db: Session, user: User, role: str, scope_type: str, scope_id: str | None = None) -> None:
    db.add(
        RoleAssignment(
            id=new_id(),
            user_id=user.id,
            role=role,
            scope_type=scope_type,
            scope_id=scope_id,
            active=True,
        )
    )


def _institution(db: Session, aicte_id: str, name: str, region: str, state: str) -> Institution:
    institution = Institution(
        id=new_id(),
        aicte_id=aicte_id,
        name=name,
        legal_holder_name=f"{name} Educational Trust",
        region_code=region,
        state=state,
        status="ACTIVE",
    )
    db.add(institution)
    return institution


def _make_instrument(
    db: Session,
    *,
    institution: Institution,
    creator: User,
    bank: str,
    branch: str,
    ifsc: str,
    fdr_number: str,
    declared_amount: str,
    document_amount: str | None,
    issue_date: date,
    maturity_date: date,
    interest_rate: str,
    lien_beneficiary: str | None,
    with_document: bool = True,
) -> Fdr:
    """Create an instrument and, optionally, its synthetic document + evidence.

    `document_amount` differing from `declared_amount` is how the mismatch
    demonstration case is produced: the document is the source of the
    discrepancy, not a flag set by hand.
    """
    fdr = Fdr(
        id=new_id(),
        institution_id=institution.id,
        created_by=creator.id,
        issuer_bank=bank,
        branch=branch,
        ifsc=ifsc,
        fdr_number_masked=mask_fdr_number(fdr_number),
        fdr_number_ciphertext=obfuscate_store(fdr_number),
        fdr_lookup_hash=lookup_hash(bank, fdr_number),
        principal_amount=Decimal(declared_amount),
        interest_rate=Decimal(interest_rate),
        issue_date=issue_date,
        maturity_date=maturity_date,
        lien_beneficiary=lien_beneficiary,
        submission_status="DRAFT",
        document_processing_status="NOT_UPLOADED",
        bank_verification_status="NOT_REQUESTED",
        review_status="NOT_SUBMITTED",
        instrument_status="REGISTERED",
        lien_status="CLAIMED" if lien_beneficiary else "UNKNOWN",
    )
    db.add(fdr)
    db.flush()

    if not with_document:
        return fdr

    printed_amount = document_amount or declared_amount
    grouped = f"{Decimal(printed_amount):,.2f}"
    payload = instrument_pdf(
        bank=bank,
        branch=branch,
        ifsc=ifsc,
        fdr_number=fdr_number,
        institution=institution.name,
        principal_amount=grouped,
        issue_date=issue_date.strftime("%d %b %Y"),
        maturity_date=maturity_date.strftime("%d %b %Y"),
        interest_rate=interest_rate,
        lien_beneficiary=lien_beneficiary,
    )

    quarantine_key = object_store.build_quarantine_key(institution.id)
    object_store.put_object(quarantine_key, payload, session=db)
    verdict = scan(payload, declared_content_type="application/pdf")
    clean_key = object_store.promote(
        quarantine_key, to_prefix=object_store.CLEAN_PREFIX, session=db
    )

    document = FdrDocument(
        id=new_id(),
        fdr_id=fdr.id,
        document_type="FDR_CERTIFICATE",
        object_key=clean_key,
        original_filename="instrument-v1.pdf",
        sha256=sha256_bytes(payload),
        content_type="application/pdf",
        size_bytes=len(payload),
        scan_status=verdict.status,
        scan_detail=verdict.detail,
        processing_status="EXTRACTING",
        version=1,
        uploaded_by=creator.id,
    )
    db.add(document)
    db.flush()

    result = extraction_engine.extract(payload)
    db.add(
        FdrExtraction(
            id=new_id(),
            document_id=document.id,
            engine=extraction_engine.ENGINE,
            engine_version=extraction_engine.ENGINE_VERSION,
            status=result.status,
            extracted_json=json.dumps(result.extracted, sort_keys=True),
            confidence_json=json.dumps(result.confidences, sort_keys=True),
            bbox_json=json.dumps(result.provenance, sort_keys=True),
            finished_at=utcnow(),
        )
    )
    document.processing_status = result.status
    fdr.document_processing_status = result.status
    fdr.submission_status = "UPLOADED"
    return fdr


def _submit(db: Session, fdr: Fdr, submitter: User) -> None:
    db.add(
        FdrSubmission(
            id=new_id(),
            fdr_id=fdr.id,
            submitted_by=submitter.id,
            submitted_at=utcnow(),
            version=1,
            claims_json=json.dumps(
                {
                    "issuer_bank": fdr.issuer_bank,
                    "principal_amount": str(fdr.principal_amount),
                    "issue_date": fdr.issue_date.isoformat(),
                    "maturity_date": fdr.maturity_date.isoformat(),
                    "lien_beneficiary": fdr.lien_beneficiary,
                },
                sort_keys=True,
            ),
            submission_status="SUBMITTED",
        )
    )
    fdr.submission_status = "SUBMITTED"
    fdr.review_status = "QUEUED"
    fdr.instrument_status = "ACTIVE"
    fdr.version += 1


def _accept(db: Session, fdr: Fdr, officer: User, reason: str) -> None:
    fdr.review_status = "ACCEPTED"
    fdr.assigned_officer_id = officer.id
    fdr.version += 1
    db.add(
        ReviewDecision(
            id=new_id(),
            fdr_id=fdr.id,
            actor_id=officer.id,
            decision="ACCEPT",
            reason=reason,
            policy_version_id=f"{load_catalog().name}@{load_catalog().version}",
        )
    )


def _mock_check(db: Session, fdr: Fdr, officer: User, scenario: str) -> None:
    from app.core.security import deobfuscate_store
    from app.domains.bank.mock_adapter import MockBankVerifier
    from app.domains.bank.ports import InstrumentClaim

    result = MockBankVerifier(enabled=True, environment="DEMO").verify(
        instrument_ref=fdr.id,
        claim=InstrumentClaim(
            fdr_number=deobfuscate_store(fdr.fdr_number_ciphertext),
            issuer_bank=fdr.issuer_bank,
            principal_amount=f"{fdr.principal_amount:.2f}",
            issue_date=fdr.issue_date.isoformat(),
            maturity_date=fdr.maturity_date.isoformat(),
            lien_beneficiary=fdr.lien_beneficiary,
        ),
        requested_checks=["NUMBER", "AMOUNT", "MATURITY_DATE", "LIEN_STATUS"],
        correlation_id=f"corr-seed-{fdr.id[:8]}",
        scenario_id=scenario,
    )
    status_map = {
        "MOCK_MATCH": "MOCK_MATCH",
        "MOCK_MISMATCH": "MOCK_MISMATCH",
        "MOCK_NOT_FOUND": "MOCK_MISMATCH",
        "MOCK_TIMEOUT": "MOCK_ERROR",
        "MOCK_SERVICE_ERROR": "MOCK_ERROR",
    }
    db.add(
        VerificationCheck(
            id=new_id(),
            fdr_id=fdr.id,
            check_type="BANK_FIELD_MATCH",
            source_kind="MOCK_BANK",
            scenario_id=result.scenario_id,
            result=status_map[result.verification_status.value],
            detail_json=json.dumps(
                {
                    "message": result.message,
                    "match_results": result.match_results,
                    "lien_claim": result.lien_claim,
                    "correlation_id": f"corr-seed-{fdr.id[:8]}",
                    "signature_valid": result.signature_valid,
                    "environment": result.environment,
                    "response_id": result.response_id,
                    **result.detail,
                },
                sort_keys=True,
                default=str,
            ),
            source_ref=result.response_id,
            response_hash=result.evidence_hash,
            is_simulated=True,
            performed_by=officer.id,
            performed_at=result.checked_at,
            expires_at=result.expires_at,
        )
    )
    fdr.bank_verification_status = status_map[result.verification_status.value]
    if result.lien_claim and result.lien_claim.startswith("NOT_CONFIRMED"):
        fdr.lien_status = "DISPUTED"
    fdr.version += 1


def seed(reset: bool = False) -> dict[str, str]:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionFactory()
    try:
        if db.scalar(select(User).limit(1)) is not None:
            return {"status": "skipped", "reason": "database already seeded"}

        catalog = load_catalog()
        policy = load_policy()
        db.add(
            PolicyVersion(
                id=new_id(),
                ruleset_name=catalog.name,
                version=catalog.version,
                sha256=catalog.sha256,
                effective_from=date(2026, 10, 1),
                published_by="SIH26265 prototype team",
            )
        )
        db.add(
            PolicyVersion(
                id=new_id(),
                ruleset_name=policy.name,
                version=policy.version,
                sha256=policy.sha256,
                effective_from=policy.effective_from,
                published_by="SIH26265 prototype team",
            )
        )

        coastal = _institution(db, "1-4521983", "Coastal Institute of Technology", "SOUTH", "Tamil Nadu")
        sunrise = _institution(db, "1-7739021", "Sunrise College of Engineering", "SOUTH", "Karnataka")
        highland = _institution(db, "1-9930114", "Highland School of Management", "WEST", "Maharashtra")
        riverine = _institution(db, "1-2210477", "Riverine Polytechnic", "EAST", "West Bengal")
        db.flush()

        coastal_submitter = _user(db, "submitter@coastal.demo", "Priya Raman (Coastal)")
        coastal_approver = _user(db, "approver@coastal.demo", "Head of Institution (Coastal)")
        sunrise_submitter = _user(db, "submitter@sunrise.demo", "Anil Kumar (Sunrise)")
        highland_submitter = _user(db, "submitter@highland.demo", "Meera Joshi (Highland)")
        riverine_submitter = _user(db, "submitter@riverine.demo", "Subhash Das (Riverine)")
        officer = _user(db, "scrutiny@aicte.demo", "Scrutiny Officer (Regulation Bureau)", mfa=True)
        officer_two = _user(db, "scrutiny2@aicte.demo", "Second Scrutiny Officer", mfa=True)
        supervisor = _user(db, "supervisor@aicte.demo", "Competent Authority", mfa=True)
        pgrc = _user(db, "pgrc@aicte.demo", "PGRC Clearance Officer", mfa=True)
        vigilance = _user(db, "vigilance@aicte.demo", "Vigilance Clearance Officer", mfa=True)
        finance = _user(db, "finance@aicte.demo", "Finance Bureau Officer", mfa=True)
        auditor = _user(db, "auditor@aicte.demo", "Read-only Auditor", mfa=True)
        admin = _user(db, "admin@aicte.demo", "Security Administrator", mfa=True)
        db.flush()

        _grant(db, coastal_submitter, "INSTITUTION_SUBMITTER", "INSTITUTION", coastal.id)
        _grant(db, coastal_approver, "INSTITUTION_APPROVER", "INSTITUTION", coastal.id)
        _grant(db, sunrise_submitter, "INSTITUTION_SUBMITTER", "INSTITUTION", sunrise.id)
        _grant(db, highland_submitter, "INSTITUTION_SUBMITTER", "INSTITUTION", highland.id)
        _grant(db, riverine_submitter, "INSTITUTION_SUBMITTER", "INSTITUTION", riverine.id)
        for region in ("SOUTH", "WEST"):
            _grant(db, officer, "SCRUTINY_OFFICER", "REGION", region)
            _grant(db, officer_two, "SCRUTINY_OFFICER", "REGION", region)
            _grant(db, supervisor, "SUPERVISOR", "REGION", region)
        for bureau_user, bureau in ((pgrc, "PGRC"), (vigilance, "VIGILANCE"), (finance, "FINANCE_BUREAU")):
            _grant(db, bureau_user, "CLEARANCE_OFFICER", "BUREAU", bureau)
            for region in ("SOUTH", "WEST"):
                _grant(db, bureau_user, "CLEARANCE_OFFICER", "REGION", region)
        _grant(db, auditor, "AUDITOR", "GLOBAL")
        _grant(db, admin, "ADMIN", "GLOBAL")
        db.flush()

        # S1 — clean submission accepted with a matching simulated check.
        clean = _make_instrument(
            db,
            institution=coastal,
            creator=coastal_submitter,
            bank="State Bank of India",
            branch="Anna Salai",
            ifsc="SBIN0001234",
            fdr_number="SBI/FDR/2024/778231",
            declared_amount="2500000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=420),
            maturity_date=TODAY + timedelta(days=240),
            interest_rate="7.10",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, clean, coastal_submitter)
        _mock_check(db, clean, officer, "MATCH_WITH_ACTIVE_LIEN")
        _accept(
            db,
            clean,
            officer,
            "Accepted for the demo administrative workflow with mock evidence. "
            "This is not a real-world authenticity assurance.",
        )

        # S2 — the document disagrees with the declared principal.
        mismatch = _make_instrument(
            db,
            institution=coastal,
            creator=coastal_submitter,
            bank="Canara Bank",
            branch="T Nagar",
            ifsc="CNRB0002211",
            fdr_number="CNRB/FD/2025/119044",
            declared_amount="2500000.00",
            document_amount="2000000.00",
            issue_date=TODAY - timedelta(days=200),
            maturity_date=TODAY + timedelta(days=165),
            interest_rate="6.95",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, mismatch, coastal_submitter)
        mismatch.review_status = "IN_REVIEW"
        mismatch.assigned_officer_id = officer.id
        _mock_check(db, mismatch, officer, "AMOUNT_MISMATCH")

        # S3 — maturity inside the warning window with no bank check recorded.
        maturing = _make_instrument(
            db,
            institution=sunrise,
            creator=sunrise_submitter,
            bank="Bank of Baroda",
            branch="Jayanagar",
            ifsc="BARB0JAYANA",
            fdr_number="BOB/FDR/2024/553310",
            declared_amount="1500000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=718),
            maturity_date=TODAY + timedelta(days=12),
            interest_rate="7.25",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, maturing, sunrise_submitter)

        # S3b — overdue with no resolved action.
        overdue = _make_instrument(
            db,
            institution=sunrise,
            creator=sunrise_submitter,
            bank="Punjab National Bank",
            branch="Rajajinagar",
            ifsc="PUNB0123456",
            fdr_number="PNB/FD/2022/884412",
            declared_amount="900000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=760),
            maturity_date=TODAY - timedelta(days=26),
            interest_rate="6.50",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, overdue, sunrise_submitter)
        _mock_check(db, overdue, officer, "LIEN_MISSING")

        # S4 — replacement chain: the predecessor keeps all of its evidence.
        predecessor = _make_instrument(
            db,
            institution=coastal,
            creator=coastal_submitter,
            bank="Indian Bank",
            branch="Mylapore",
            ifsc="IDIB000M123",
            fdr_number="IDIB/FD/2023/220871",
            declared_amount="1200000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=800),
            maturity_date=TODAY - timedelta(days=60),
            interest_rate="6.80",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, predecessor, coastal_submitter)
        _accept(db, predecessor, officer, "Accepted before replacement; evidence retained.")
        successor = _make_instrument(
            db,
            institution=coastal,
            creator=coastal_submitter,
            bank="Indian Bank",
            branch="Mylapore",
            ifsc="IDIB000M123",
            fdr_number="IDIB/FD/2026/551907",
            declared_amount="1285000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=55),
            maturity_date=TODAY + timedelta(days=310),
            interest_rate="7.05",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, successor, coastal_submitter)
        _mock_check(db, successor, officer, "MATCH_WITH_ACTIVE_LIEN")
        _accept(db, successor, officer, "Successor instrument accepted for the demo workflow.")
        db.add(
            FdrLink(
                id=new_id(),
                predecessor_fdr_id=predecessor.id,
                successor_fdr_id=successor.id,
                relationship_type="REPLACEMENT",
                effective_date=TODAY - timedelta(days=55),
                reason="Original instrument matured and was replaced by a fresh deposit.",
                recorded_by=coastal_submitter.id,
            )
        )
        predecessor.instrument_status = "SUPERSEDED"

        # S5 — release case blocked while Vigilance is pending.
        release_fdr = _make_instrument(
            db,
            institution=highland,
            creator=highland_submitter,
            bank="HDFC Bank",
            branch="Andheri East",
            ifsc="HDFC0000321",
            fdr_number="HDFC/FD/2023/908112",
            declared_amount="3000000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=900),
            maturity_date=TODAY - timedelta(days=15),
            interest_rate="7.40",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, release_fdr, highland_submitter)
        _mock_check(db, release_fdr, officer, "MATCH_WITH_ACTIVE_LIEN")
        _accept(db, release_fdr, officer, "Accepted; the institution may proceed with its request.")
        db.flush()

        basis = policy.basis("COURSE_WITHDRAWAL")
        release_request = ReleaseRequest(
            id=new_id(),
            fdr_id=release_fdr.id,
            institution_id=highland.id,
            requested_by=highland_submitter.id,
            basis_code="COURSE_WITHDRAWAL",
            justification=(
                "Programme withdrawn from the forthcoming academic year; requesting release "
                "of the security deposit held against it."
            ),
            status="CLEARANCES_PENDING",
            policy_version_id=f"{policy.name}@{policy.version}+{policy.sha256[:8]}",
        )
        db.add(release_request)
        db.flush()

        release_document = db.scalar(
            select(FdrDocument).where(FdrDocument.fdr_id == release_fdr.id)
        )
        for document_type in basis["required_documents"]:
            db.add(
                ReleaseDocument(
                    id=new_id(),
                    request_id=release_request.id,
                    document_id=release_document.id,
                    document_type=document_type,
                    checklist_version=policy.version,
                )
            )

        requirements: dict[str, ClearanceRequirement] = {}
        for bureau_code in basis["clearances"]:
            requirement = ClearanceRequirement(
                id=new_id(),
                request_id=release_request.id,
                bureau_code=bureau_code,
                bureau_name=policy.bureau_name(bureau_code),
                requirement_version=policy.version,
                required=True,
                state="PENDING",
            )
            db.add(requirement)
            requirements[bureau_code] = requirement
        db.flush()

        # PGRC clears; Finance Bureau is deliberately left pending so the
        # demonstration can show a blocked final approval.
        requirements["PGRC"].state = "CLEARED"
        db.add(
            ClearanceDecision(
                id=new_id(),
                requirement_id=requirements["PGRC"].id,
                actor_id=pgrc.id,
                outcome="CLEARED",
                reason="No grievance pending against the institution on record.",
                valid_until=TODAY + timedelta(days=180),
                decided_at=utcnow(),
            )
        )

        # A second release case, already on hold after an objection.
        held_fdr = _make_instrument(
            db,
            institution=riverine,
            creator=riverine_submitter,
            bank="UCO Bank",
            branch="Salt Lake",
            ifsc="UCBA0001122",
            fdr_number="UCO/FD/2022/330055",
            declared_amount="750000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=1100),
            maturity_date=TODAY - timedelta(days=200),
            interest_rate="6.20",
            lien_beneficiary="AICTE, New Delhi",
        )
        _submit(db, held_fdr, riverine_submitter)
        _accept(db, held_fdr, officer_two, "Accepted; release request raised separately.")
        db.flush()
        held_basis = policy.basis("MATURITY_REFUND")
        held_request = ReleaseRequest(
            id=new_id(),
            fdr_id=held_fdr.id,
            institution_id=riverine.id,
            requested_by=riverine_submitter.id,
            basis_code="MATURITY_REFUND",
            justification="Deposit matured; requesting refund of the matured amount.",
            status="ON_HOLD",
            hold_reason="VIGILANCE recorded an objection: an inspection observation is open.",
            policy_version_id=f"{policy.name}@{policy.version}+{policy.sha256[:8]}",
        )
        db.add(held_request)
        db.flush()
        held_document = db.scalar(select(FdrDocument).where(FdrDocument.fdr_id == held_fdr.id))
        db.add(
            ReleaseDocument(
                id=new_id(),
                request_id=held_request.id,
                document_id=held_document.id,
                document_type="APPLICATION_LETTER",
                checklist_version=policy.version,
            )
        )
        for bureau_code in held_basis["clearances"]:
            requirement = ClearanceRequirement(
                id=new_id(),
                request_id=held_request.id,
                bureau_code=bureau_code,
                bureau_name=policy.bureau_name(bureau_code),
                requirement_version=policy.version,
                required=True,
                state="OBJECTION" if bureau_code == "VIGILANCE" else "PENDING",
            )
            db.add(requirement)
            db.flush()
            if bureau_code == "VIGILANCE":
                db.add(
                    ClearanceDecision(
                        id=new_id(),
                        requirement_id=requirement.id,
                        actor_id=vigilance.id,
                        outcome="OBJECTION",
                        reason="An inspection observation is open against the institution.",
                        decided_at=utcnow(),
                    )
                )

        # S7 — a draft with no document yet, for the wizard walkthrough.
        _make_instrument(
            db,
            institution=highland,
            creator=highland_submitter,
            bank="Axis Bank",
            branch="Powai",
            ifsc="UTIB0000456",
            fdr_number="UTIB/FD/2026/771200",
            declared_amount="1750000.00",
            document_amount=None,
            issue_date=TODAY - timedelta(days=20),
            maturity_date=TODAY + timedelta(days=345),
            interest_rate="7.00",
            lien_beneficiary="AICTE, New Delhi",
            with_document=False,
        )

        record_audit(
            db,
            aggregate_type="system",
            aggregate_id="seed",
            action="system.seeded",
            new_state={
                "institutions": 4,
                "users": 13,
                "ruleset": f"{catalog.name}@{catalog.version}",
                "release_policy": f"{policy.name}@{policy.version}",
            },
            reason="Synthetic demonstration dataset loaded",
        )
        db.commit()

        for fdr in db.scalars(select(Fdr)):
            sync_findings(db, fdr)
        db.commit()

        scan_result = run_maturity_scan(db)
        return {
            "status": "seeded",
            "institutions": "4",
            "users": "13",
            "reminders_created": str(scan_result["created"]),
            "password": DEMO_PASSWORD,
        }
    finally:
        db.close()


if __name__ == "__main__":
    print(seed(reset="--reset" in sys.argv))
