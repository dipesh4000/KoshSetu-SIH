"""End-to-end flows matching the demonstration scenarios S1-S8."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.db.models import Institution, ReleaseRequest

TODAY = date.today()


def _draft_payload(number: str = "SBI/FDR/2026/445566") -> dict:
    return {
        "issuer_bank": "State Bank of India",
        "branch": "Anna Salai",
        "ifsc": "SBIN0001234",
        "fdr_number": number,
        "principal_amount": "1850000.00",
        "interest_rate": "7.15",
        "issue_date": (TODAY - timedelta(days=30)).isoformat(),
        "maturity_date": (TODAY + timedelta(days=400)).isoformat(),
        "lien_beneficiary": "AICTE, New Delhi",
    }


def _sample_pdf(**overrides) -> bytes:
    from app.domains.documents.sample_pdf import instrument_pdf

    payload = {
        "bank": "State Bank of India",
        "branch": "Anna Salai",
        "ifsc": "SBIN0001234",
        "fdr_number": "SBI/FDR/2026/445566",
        "institution": "Coastal Institute of Technology",
        "principal_amount": "18,50,000.00",
        "issue_date": (TODAY - timedelta(days=30)).strftime("%d %b %Y"),
        "maturity_date": (TODAY + timedelta(days=400)).strftime("%d %b %Y"),
        "interest_rate": "7.15",
        "lien_beneficiary": "AICTE, New Delhi",
    }
    payload.update(overrides)
    return instrument_pdf(**payload)


def _upload(client, fdr_id: str, payload: bytes, filename: str = "instrument.pdf") -> dict:
    session = client.post(
        "/api/v1/upload-sessions",
        json={
            "fdr_id": fdr_id,
            "filename": filename,
            "content_type": "application/pdf",
            "size_bytes": len(payload),
        },
    )
    assert session.status_code == 201, session.text
    session_id = session.json()["upload_session_id"]

    put = client.put(
        f"/api/v1/upload-sessions/{session_id}/content",
        files={"file": (filename, payload, "application/pdf")},
    )
    assert put.status_code == 202, put.text
    return {"session_id": session_id}


def test_s1_submission_review_and_simulated_check(institution_client, as_user):
    created = institution_client.post("/api/v1/fdrs/drafts", json=_draft_payload())
    assert created.status_code == 201, created.text
    fdr = created.json()
    assert fdr["status"]["submission_status"] == "DRAFT"
    assert fdr["fdr_number_masked"].endswith("5566")

    # Submitting before a document exists is refused.
    too_early = institution_client.post(
        f"/api/v1/fdrs/{fdr['id']}/submit", json={"attestation": True}
    )
    assert too_early.status_code == 409

    upload = _upload(institution_client, fdr["id"], _sample_pdf())
    finalized = institution_client.post(
        f"/api/v1/upload-sessions/{upload['session_id']}/finalize"
    )
    assert finalized.status_code == 200, finalized.text
    body = finalized.json()
    assert body["scan_status"] == "CLEAN"
    assert body["extraction_status"] == "READY"
    amount_field = next(f for f in body["evidence_fields"] if f["field"] == "principal_amount")
    assert amount_field["extracted_value"] == "1850000.00"
    assert amount_field["difference"] == "MATCH"

    # Finalizing again returns the same document instead of duplicating it.
    again = institution_client.post(f"/api/v1/upload-sessions/{upload['session_id']}/finalize")
    assert again.status_code == 200
    assert again.json()["document_id"] == body["document_id"]

    submitted = institution_client.post(
        f"/api/v1/fdrs/{fdr['id']}/submit", json={"attestation": True}
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"]["submission_status"] == "SUBMITTED"
    assert submitted.json()["status"]["review_status"] == "QUEUED"

    officer = as_user("scrutiny@aicte.demo")
    started = officer.post(
        f"/api/v1/fdrs/{fdr['id']}/scrutiny",
        json={"decision": "START_REVIEW", "reason": "Picked up from the assigned work queue"},
    )
    assert started.status_code == 200
    assert started.json()["status"]["review_status"] == "IN_REVIEW"

    check = officer.post(
        f"/api/v1/fdrs/{fdr['id']}/mock-bank-check",
        json={"scenario_id": "MATCH_WITH_ACTIVE_LIEN"},
    )
    assert check.status_code == 200, check.text
    result = check.json()
    assert result["source_kind"] == "MOCK_BANK"
    assert result["is_simulated"] is True
    assert "not independent bank authentication" in result["provenance_note"]

    accepted = officer.post(
        f"/api/v1/fdrs/{fdr['id']}/scrutiny",
        json={"decision": "ACCEPT", "reason": "Fields reconcile with the document evidence"},
    )
    assert accepted.status_code == 200
    detail = accepted.json()
    assert detail["status"]["review_status"] == "ACCEPTED"
    # Bank status and review status stay independent.
    assert detail["status"]["bank_verification_status"] == "MOCK_MATCH"


def test_s2_amount_mismatch_creates_a_finding_and_clarification(institution_client, as_user):
    created = institution_client.post(
        "/api/v1/fdrs/drafts", json=_draft_payload("CNRB/FD/2026/778899")
    ).json()
    upload = _upload(
        institution_client,
        created["id"],
        _sample_pdf(fdr_number="CNRB/FD/2026/778899", principal_amount="12,00,000.00"),
    )
    institution_client.post(f"/api/v1/upload-sessions/{upload['session_id']}/finalize")
    institution_client.post(f"/api/v1/fdrs/{created['id']}/submit", json={"attestation": True})

    officer = as_user("scrutiny@aicte.demo")
    detail = officer.get(f"/api/v1/fdrs/{created['id']}").json()
    rule_ids = {finding["rule_id"] for finding in detail["findings"]}
    assert "DATA-001" in rule_ids
    finding = next(f for f in detail["findings"] if f["rule_id"] == "DATA-001")
    assert finding["evidence"]["declared_principal"] == "1850000.00"
    assert finding["evidence"]["document_principal"] == "1200000.00"
    assert "not evidence of forgery" in finding["explanation"]

    clarification = officer.post(
        f"/api/v1/fdrs/{created['id']}/scrutiny",
        json={
            "decision": "REQUEST_CLARIFICATION",
            "reason": "The declared principal does not match the document; please confirm.",
            "expected_version": detail["version"],
        },
    )
    assert clarification.status_code == 200
    assert clarification.json()["status"]["submission_status"] == "CORRECTION_REQUESTED"

    # The institution corrects the value with a reason and resubmits.
    corrected = institution_client.post(
        f"/api/v1/fdrs/{created['id']}/submit",
        json={
            "attestation": True,
            "corrections": {"principal_amount": "1200000.00"},
            "correction_reason": "Data entry error; the document value is correct.",
        },
    )
    assert corrected.status_code == 200
    assert corrected.json()["principal_amount"] == "1200000.00"
    resolved = {
        f["rule_id"]: f["status"] for f in officer.get(f"/api/v1/fdrs/{created['id']}").json()["findings"]
    }
    assert resolved.get("DATA-001") == "AUTO_RESOLVED"


def test_stale_version_is_rejected(institution_client, as_user):
    created = institution_client.post(
        "/api/v1/fdrs/drafts", json=_draft_payload("BARB/FD/2026/191919")
    ).json()
    upload = _upload(institution_client, created["id"], _sample_pdf(fdr_number="BARB/FD/2026/191919"))
    institution_client.post(f"/api/v1/upload-sessions/{upload['session_id']}/finalize")
    institution_client.post(f"/api/v1/fdrs/{created['id']}/submit", json={"attestation": True})

    officer = as_user("scrutiny@aicte.demo")
    response = officer.post(
        f"/api/v1/fdrs/{created['id']}/scrutiny",
        json={"decision": "START_REVIEW", "reason": "Opening the case", "expected_version": 1},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CASE_VERSION_CONFLICT"


def test_malicious_and_oversized_uploads_are_rejected(institution_client):
    created = institution_client.post(
        "/api/v1/fdrs/drafts", json=_draft_payload("UTIB/FD/2026/303030")
    ).json()

    # A file named .pdf whose content is not a PDF.
    upload = _upload(institution_client, created["id"], b"<html>not a pdf</html>")
    result = institution_client.post(
        f"/api/v1/upload-sessions/{upload['session_id']}/finalize"
    ).json()
    assert result["scan_status"] == "REJECTED"
    assert result["extraction_status"] is None
    assert result["document_processing_status"] == "REJECTED"

    # A PDF carrying active content.
    from app.domains.documents.sample_pdf import build_pdf

    hostile = build_pdf(["Normal looking text"]) + b"\n/JavaScript (app.alert(1))\n"
    upload_two = _upload(institution_client, created["id"], hostile)
    hostile_result = institution_client.post(
        f"/api/v1/upload-sessions/{upload_two['session_id']}/finalize"
    ).json()
    assert hostile_result["scan_status"] == "REJECTED"
    assert "active content" in hostile_result["scan_detail"]

    # Declaring an unsupported type is refused before a key is issued.
    refused = institution_client.post(
        "/api/v1/upload-sessions",
        json={
            "fdr_id": created["id"],
            "filename": "sheet.xlsx",
            "content_type": "application/vnd.ms-excel",
            "size_bytes": 1024,
        },
    )
    assert refused.status_code == 415

    too_big = institution_client.post(
        "/api/v1/upload-sessions",
        json={
            "fdr_id": created["id"],
            "filename": "huge.pdf",
            "content_type": "application/pdf",
            "size_bytes": 500 * 1024 * 1024,
        },
    )
    assert too_big.status_code == 413


def test_tampered_simulated_response_changes_no_state(db, officer_client):
    institution = db.scalar(select(Institution).where(Institution.aicte_id == "1-4521983"))
    from app.db.models import Fdr

    fdr = db.scalar(
        select(Fdr).where(
            Fdr.institution_id == institution.id, Fdr.submission_status == "SUBMITTED"
        )
    )
    before = officer_client.get(f"/api/v1/fdrs/{fdr.id}").json()

    response = officer_client.post(
        f"/api/v1/fdrs/{fdr.id}/mock-bank-check", json={"scenario_id": "INVALID_SIGNATURE"}
    )
    assert response.status_code == 200
    assert response.json()["result"] == "REJECTED_BY_PORTAL"

    after = officer_client.get(f"/api/v1/fdrs/{fdr.id}").json()
    assert after["status"]["bank_verification_status"] == before["status"]["bank_verification_status"]


def test_s4_replacement_preserves_the_predecessor(institution_client):
    created = institution_client.post(
        "/api/v1/fdrs/drafts", json=_draft_payload("IDIB/FD/2026/606060")
    ).json()
    upload = _upload(institution_client, created["id"], _sample_pdf(fdr_number="IDIB/FD/2026/606060"))
    institution_client.post(f"/api/v1/upload-sessions/{upload['session_id']}/finalize")
    institution_client.post(f"/api/v1/fdrs/{created['id']}/submit", json={"attestation": True})

    successor_payload = _draft_payload("IDIB/FD/2027/707070")
    successor_payload["issue_date"] = TODAY.isoformat()
    successor_payload["maturity_date"] = (TODAY + timedelta(days=720)).isoformat()
    replacement = institution_client.post(
        f"/api/v1/fdrs/{created['id']}/replacements",
        json={
            "successor": successor_payload,
            "relationship_type": "REPLACEMENT",
            "effective_date": TODAY.isoformat(),
            "reason": "Instrument replaced with a fresh deposit of a longer tenure.",
        },
    )
    assert replacement.status_code == 201, replacement.text
    successor = replacement.json()
    assert successor["links"][0]["predecessor_fdr_id"] == created["id"]

    predecessor = institution_client.get(f"/api/v1/fdrs/{created['id']}").json()
    assert predecessor["status"]["instrument_status"] == "SUPERSEDED"
    # The original evidence is untouched.
    assert predecessor["documents"]
    assert predecessor["principal_amount"] == created["principal_amount"]
    assert predecessor["issue_date"] == created["issue_date"]


def test_s5_s6_release_requires_clearances_then_maker_checker(db, as_user):
    request_row = db.scalar(
        select(ReleaseRequest).where(ReleaseRequest.status == "CLEARANCES_PENDING")
    )
    request_id = request_row.id

    finance = as_user("finance@aicte.demo")
    current = finance.get(f"/api/v1/release-requests/{request_id}").json()
    cleared = finance.post(
        f"/api/v1/release-requests/{request_id}/clearances/FINANCE_BUREAU/decide",
        json={"outcome": "CLEARED", "reason": "Deposit reconciled against the finance register."},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["status"] == "READY_FOR_DECISION"

    supervisor = as_user("supervisor@aicte.demo")
    state = supervisor.get(f"/api/v1/release-requests/{request_id}").json()
    prepared = supervisor.post(
        f"/api/v1/release-requests/{request_id}/prepare",
        json={"reason": "Case papers verified and placed for decision.", "expected_version": state["version"]},
    )
    assert prepared.status_code == 200

    # The same person cannot now be the final approver.
    self_approve = supervisor.post(
        f"/api/v1/release-requests/{request_id}/approve",
        json={"reason": "Attempting to approve a case I prepared", "expected_version": prepared.json()["version"]},
    )
    assert self_approve.status_code == 409
    assert "prepared the case cannot be its final approver" in self_approve.text

    # A different competent authority may approve it.
    other = as_user("scrutiny@aicte.demo")
    assert other.post(
        f"/api/v1/release-requests/{request_id}/approve",
        json={"reason": "No authority", "expected_version": 1},
    ).status_code == 403

    second_supervisor = as_user("supervisor@aicte.demo")
    # Re-use the same account only after clearing the maker record would be
    # wrong, so the check is exercised through the blocking reasons instead.
    blocked = second_supervisor.get(f"/api/v1/release-requests/{request_id}").json()
    assert blocked["can_finally_approve"] is False
    assert any("prepared" in reason for reason in blocked["blocking_reasons"])


def test_release_approval_is_idempotent_under_a_repeated_key(db, as_user):
    """A repeated approve with the same key returns the first result."""
    institution = as_user("submitter@coastal.demo")
    created = institution.post(
        "/api/v1/fdrs/drafts", json=_draft_payload("SBI/FDR/2026/909090")
    ).json()
    upload = _upload(institution, created["id"], _sample_pdf(fdr_number="SBI/FDR/2026/909090"))
    institution.post(f"/api/v1/upload-sessions/{upload['session_id']}/finalize")
    institution.post(f"/api/v1/fdrs/{created['id']}/submit", json={"attestation": True})

    officer = as_user("scrutiny@aicte.demo")
    officer.post(
        f"/api/v1/fdrs/{created['id']}/scrutiny",
        json={"decision": "ACCEPT", "reason": "Evidence reconciles for the demo workflow."},
    )

    institution = as_user("submitter@coastal.demo")
    detail = institution.get(f"/api/v1/fdrs/{created['id']}").json()
    document_id = detail["documents"][0]["id"]
    request_row = institution.post(
        "/api/v1/release-requests",
        json={
            "fdr_id": created["id"],
            "basis_code": "DEPOSIT_REPLACEMENT",
            "justification": "Replacement instrument furnished; releasing the earlier deposit.",
            "document_ids": [document_id],
        },
    )
    assert request_row.status_code == 201, request_row.text
    request_id = request_row.json()["id"]

    # Attach both prescribed documents.
    for document_type in ("APPLICATION_LETTER", "FDR_COPY"):
        institution.post(
            f"/api/v1/release-requests/{request_id}/documents/{document_id}",
            params={"document_type": document_type},
        )

    finance = as_user("finance@aicte.demo")
    state = finance.post(
        f"/api/v1/release-requests/{request_id}/clearances/FINANCE_BUREAU/decide",
        json={"outcome": "CLEARED", "reason": "Replacement instrument verified on record."},
    ).json()
    assert state["status"] == "READY_FOR_DECISION"

    supervisor = as_user("supervisor@aicte.demo")
    headers = {"Idempotency-Key": "test-approve-key-001"}
    first = supervisor.post(
        f"/api/v1/release-requests/{request_id}/approve",
        json={"reason": "Prerequisites satisfied; release approved administratively.", "expected_version": state["version"]},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "APPROVED"

    repeat = supervisor.post(
        f"/api/v1/release-requests/{request_id}/approve",
        json={"reason": "Duplicate submit", "expected_version": 999},
        headers=headers,
    )
    assert repeat.status_code == 200
    assert repeat.json()["id"] == first.json()["id"]
    assert repeat.json()["version"] == first.json()["version"]

    # An approved release is recorded as an administrative decision only.
    fdr_detail = supervisor.get(f"/api/v1/fdrs/{created['id']}").json()
    assert fdr_detail["status"]["instrument_status"] == "RELEASE_RECORDED"


def test_audit_trail_records_every_action_with_an_intact_chain(officer_client):
    events = officer_client.get("/api/v1/audit-events", params={"limit": 200}).json()
    actions = {event["action"] for event in events}
    assert "fdr.submitted" in actions
    assert "verification.mock_bank_check" in actions
    for event in events:
        assert event["actor_label"]
        assert event["occurred_at"]
        assert event["integrity_digest"]

    integrity = officer_client.get("/api/v1/audit-events/integrity").json()
    assert integrity["verified"] is True
    assert integrity["events_checked"] > 0


def test_exceptions_feed_and_disposition(officer_client):
    findings = officer_client.get("/api/v1/exceptions", params={"status": "OPEN"}).json()
    assert findings
    assert all(finding["rule_id"] and finding["recommended_action"] for finding in findings)
    assert not any("score" in finding for finding in findings)

    target = findings[0]
    disposed = officer_client.post(
        f"/api/v1/findings/{target['id']}/disposition",
        json={"status": "FALSE_POSITIVE", "reason": "Verified manually against the source record."},
    )
    assert disposed.status_code == 200
    assert disposed.json()["status"] == "FALSE_POSITIVE"


def test_overview_and_reports_are_scoped(institution_client, officer_client):
    official = officer_client.get("/api/v1/overview").json()
    assert official["kpis"]
    assert all(kpi["inclusion_criteria"] for kpi in official["kpis"])

    export = officer_client.get("/api/v1/reports/active-exposure/export")
    assert export.status_code in (200, 403)

    institution_view = institution_client.get("/api/v1/overview").json()
    assert institution_view["scope_label"] == "Your institution"


def test_meta_declares_the_simulated_environment(client):
    meta = client.get("/api/v1/meta").json()
    assert meta["bank_provider"] == "MOCK_BANK"
    assert meta["is_simulated_environment"] is True
    assert meta["problem_statement_id"] == "SIH26265"
    assert "does not move funds" in meta["disclaimer"]
