"""Security-boundary tests drawn from the brief's P0 verification matrix."""

from __future__ import annotations

from sqlalchemy import select

from app.db.models import Fdr, Institution, ReleaseRequest


def _coastal_fdr_id(db) -> str:
    institution = db.scalar(select(Institution).where(Institution.aicte_id == "1-4521983"))
    return db.scalar(
        select(Fdr.id).where(Fdr.institution_id == institution.id).order_by(Fdr.created_at)
    )


def test_unauthenticated_request_is_rejected(client):
    response = client.get("/api/v1/fdrs")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_login_failure_does_not_reveal_whether_the_account_exists(client):
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Demo@12345"}
    )
    wrong_password = client.post(
        "/api/v1/auth/login", json={"email": "submitter@coastal.demo", "password": "WrongPass1"}
    )
    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json()["error"]["message"] == wrong_password.json()["error"]["message"]


def test_institution_cannot_read_another_institutions_instrument(db, other_institution_client):
    coastal_id = _coastal_fdr_id(db)
    response = other_institution_client.get(f"/api/v1/fdrs/{coastal_id}")
    assert response.status_code in (403, 404)
    assert "principal_amount" not in response.text
    assert "2500000" not in response.text


def test_institution_list_is_scoped_to_its_own_records(db, institution_client):
    coastal = db.scalar(select(Institution).where(Institution.aicte_id == "1-4521983"))
    rows = institution_client.get("/api/v1/fdrs").json()
    assert rows
    assert {row["institution_id"] for row in rows} == {coastal.id}


def test_institution_cannot_record_a_scrutiny_decision(db, institution_client):
    coastal_id = _coastal_fdr_id(db)
    response = institution_client.post(
        f"/api/v1/fdrs/{coastal_id}/scrutiny",
        json={"decision": "ACCEPT", "reason": "Attempting to self-accept the submission"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "INSUFFICIENT_SCOPE"


def test_institution_cannot_run_a_bank_simulation(db, institution_client):
    coastal_id = _coastal_fdr_id(db)
    response = institution_client.post(
        f"/api/v1/fdrs/{coastal_id}/mock-bank-check", json={"scenario_id": "MATCH_WITH_ACTIVE_LIEN"}
    )
    assert response.status_code == 403


def test_cookie_authenticated_write_without_csrf_token_is_denied(client):
    client.post(
        "/api/v1/auth/login",
        json={"email": "submitter@coastal.demo", "password": "Demo@12345"},
    )
    # No X-CSRF-Token header: a cross-site form post would look like this.
    response = client.post(
        "/api/v1/fdrs/drafts",
        json={
            "issuer_bank": "State Bank of India",
            "fdr_number": "SBI/FDR/2026/000001",
            "principal_amount": "100000.00",
            "issue_date": "2026-01-01",
            "maturity_date": "2027-01-01",
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_FAILED"


def test_auditor_cannot_mutate_a_case(db, as_user):
    auditor = as_user("auditor@aicte.demo")
    coastal_id = _coastal_fdr_id(db)
    response = auditor.post(
        f"/api/v1/fdrs/{coastal_id}/scrutiny",
        json={"decision": "ACCEPT", "reason": "Auditors must not be able to decide cases"},
    )
    assert response.status_code == 403


def test_clearance_officer_cannot_decide_another_bureaus_clearance(db, as_user):
    pgrc = as_user("pgrc@aicte.demo")
    request_row = db.scalar(
        select(ReleaseRequest).where(ReleaseRequest.status == "CLEARANCES_PENDING")
    )
    response = pgrc.post(
        f"/api/v1/release-requests/{request_row.id}/clearances/FINANCE_BUREAU/decide",
        json={"outcome": "CLEARED", "reason": "Attempting to clear a bureau I am not assigned to"},
    )
    assert response.status_code == 403


def test_release_cannot_be_approved_while_a_clearance_is_pending(db, supervisor_client):
    request_row = db.scalar(
        select(ReleaseRequest).where(ReleaseRequest.status == "CLEARANCES_PENDING")
    )
    detail = supervisor_client.get(f"/api/v1/release-requests/{request_row.id}").json()
    assert detail["can_finally_approve"] is False
    assert any("FINANCE_BUREAU" in reason for reason in detail["blocking_reasons"])

    response = supervisor_client.post(
        f"/api/v1/release-requests/{request_row.id}/approve",
        json={"reason": "Attempting approval with an outstanding clearance", "expected_version": detail["version"]},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RELEASE_PREREQUISITES_UNMET"


def test_document_download_requires_a_ticket(db, officer_client):
    coastal_id = _coastal_fdr_id(db)
    detail = officer_client.get(f"/api/v1/fdrs/{coastal_id}").json()
    document_id = detail["documents"][0]["id"]

    ticket = officer_client.post(
        f"/api/v1/fdrs/{coastal_id}/documents/{document_id}/download-ticket"
    ).json()
    assert ticket["ttl_seconds"] <= 300

    ok = officer_client.get("/api/v1/documents/content", params={"ticket": ticket["ticket"]})
    assert ok.status_code == 200
    assert ok.content.startswith(b"%PDF-")
    assert ok.headers["cache-control"] == "no-store"

    forged = officer_client.get("/api/v1/documents/content", params={"ticket": "not-a-ticket"})
    assert forged.status_code == 403


def test_another_institution_cannot_use_a_download_ticket_path(db, other_institution_client):
    coastal_id = _coastal_fdr_id(db)
    response = other_institution_client.post(
        f"/api/v1/fdrs/{coastal_id}/documents/any-document/download-ticket"
    )
    assert response.status_code in (403, 404)


def test_security_headers_are_present(client):
    response = client.get("/health")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-request-id"]


def test_full_fdr_number_is_never_returned_by_the_api(db, officer_client):
    coastal_id = _coastal_fdr_id(db)
    body = officer_client.get(f"/api/v1/fdrs/{coastal_id}").text
    assert "SBI/FDR/2024/778231" not in body
    assert "*8231" in body


def test_sign_out_clears_the_session(as_user, client):
    signed_in = as_user("scrutiny@aicte.demo")
    assert signed_in.get("/api/v1/me").status_code == 200

    response = signed_in.post("/api/v1/auth/logout")
    assert response.status_code == 204
    # The cookie must actually be cleared, not merely intended to be.
    assert signed_in.cookies.get("koshsetu_session") in (None, "")
    assert signed_in.get("/api/v1/me").status_code == 401
