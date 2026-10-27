"""Real multi-connection checks; SQLite is not evidence for PostgreSQL locking."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.db.session import engine, SessionFactory
from app.db.models import ApprovalDecision
from app.main import app
from app.domains.audit.service import record_audit, verify_chain

pytestmark = pytest.mark.skipif(
    engine.dialect.name != "postgresql",
    reason="Requires KOSHSETU_TEST_DATABASE_URL pointing at an isolated PostgreSQL test database",
)


def test_twenty_concurrent_audit_appends_have_one_chain():
    def append(index):
        with SessionFactory() as db:
            record_audit(
                db,
                aggregate_type="concurrency_test",
                aggregate_id=str(index),
                action="test.concurrent_append",
                reason="20 parallel writers",
            )
            db.commit()

    with ThreadPoolExecutor(max_workers=20) as pool:
        list(pool.map(append, range(20)))
    with SessionFactory() as db:
        assert verify_chain(db)["verified"]


def test_twenty_concurrent_approvals_yield_one_decision(as_user):
    from test_api_workflow import _draft_payload, _upload, _sample_pdf

    institution = as_user("submitter@coastal.demo")
    reference = "SBI/FDR/2026/" + uuid4().hex[:12]
    instrument = institution.post(
        "/api/v1/fdrs/drafts", json=_draft_payload(reference)
    ).json()
    upload = _upload(institution, instrument["id"], _sample_pdf(fdr_number=reference))
    assert (
        institution.post(
            f"/api/v1/upload-sessions/{upload['session_id']}/finalize"
        ).status_code
        == 200
    )
    assert (
        institution.post(
            f"/api/v1/fdrs/{instrument['id']}/submit", json={"attestation": True}
        ).status_code
        == 200
    )
    officer = as_user("scrutiny@aicte.demo")
    assert (
        officer.post(
            f"/api/v1/fdrs/{instrument['id']}/scrutiny",
            json={"decision": "ACCEPT", "reason": "Synthetic evidence reconciled."},
        ).status_code
        == 200
    )
    document = institution.get(f"/api/v1/fdrs/{instrument['id']}").json()["documents"][
        0
    ]["id"]
    case = institution.post(
        "/api/v1/release-requests",
        json={
            "fdr_id": instrument["id"],
            "basis_code": "DEPOSIT_REPLACEMENT",
            "justification": "Synthetic concurrency test",
            "document_ids": [document],
        },
    ).json()
    for kind in ("APPLICATION_LETTER", "FDR_COPY"):
        assert (
            institution.post(
                f"/api/v1/release-requests/{case['id']}/documents/{document}",
                params={"document_type": kind},
            ).status_code
            == 200
        )
    finance = as_user("finance@aicte.demo")
    state = finance.post(
        f"/api/v1/release-requests/{case['id']}/clearances/FINANCE_BUREAU/decide",
        json={
            "outcome": "CLEARED",
            "reason": "Synthetic replacement evidence checked.",
        },
    ).json()
    supervisor = as_user("supervisor@aicte.demo")
    token = supervisor.cookies.get("koshsetu_session")

    def approve(_):
        with TestClient(app) as client:
            return client.post(
                f"/api/v1/release-requests/{case['id']}/approve",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "reason": "Administrative approval for synthetic concurrency check",
                    "expected_version": state["version"],
                },
            ).status_code

    with ThreadPoolExecutor(max_workers=20) as pool:
        outcomes = list(pool.map(approve, range(20)))
    assert outcomes.count(200) == 1, outcomes
    assert outcomes.count(409) == 19, outcomes
    with SessionFactory() as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(ApprovalDecision)
                .where(
                    ApprovalDecision.request_id == case["id"],
                    ApprovalDecision.stage == "FINAL",
                )
            )
            == 1
        )
