"""Storage backends and the operational routes used by a hosted deployment."""

from __future__ import annotations

import pytest

from app.core.config import settings
from app.domains.documents.sample_pdf import instrument_pdf
from app.infrastructure import storage


@pytest.fixture(params=["filesystem", "database"])
def storage_backend(request, monkeypatch):
    """Exercise both object stores through the same facade."""
    monkeypatch.setattr(settings, "storage_backend", request.param)
    return request.param


def _pdf() -> bytes:
    return instrument_pdf(
        bank="State Bank of India",
        branch="Anna Salai",
        ifsc="SBIN0001234",
        fdr_number="SBI/FDR/2026/STORAGE",
        institution="Storage Test Institute",
        principal_amount="1,00,000.00",
        issue_date="01 Jan 2026",
        maturity_date="01 Jan 2027",
        interest_rate="7.00",
        lien_beneficiary="AICTE, New Delhi",
    )


def test_object_round_trip_and_promotion(storage_backend, db):
    payload = _pdf()
    key = storage.build_quarantine_key("institution-under-test")
    assert key.startswith("quarantine/")

    storage.put_object(key, payload, session=db)
    db.commit()

    assert storage.object_exists(key, session=db) is True
    assert storage.object_size(key, session=db) == len(payload)
    assert storage.read_object(key, session=db) == payload

    clean_key = storage.promote(key, to_prefix=storage.CLEAN_PREFIX, session=db)
    db.commit()
    assert clean_key.startswith("clean/")
    # The quarantine address stops resolving once the object is promoted.
    assert storage.object_exists(key, session=db) is False
    assert storage.read_object(clean_key, session=db) == payload


def test_missing_object_is_reported_not_guessed(storage_backend, db):
    with pytest.raises((FileNotFoundError, OSError)):
        storage.read_object("clean/local/nobody/missing.pdf", session=db)


def test_generated_keys_never_reuse_the_user_filename(storage_backend):
    first = storage.build_quarantine_key("institution-a")
    second = storage.build_quarantine_key("institution-a")
    assert first != second
    assert "institution-a" in first
    assert ".pdf" in first


# --- operational routes -------------------------------------------------------


def test_ops_routes_are_closed_when_no_secret_is_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_secret", "")
    response = client.post("/api/v1/ops/bootstrap")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DEPENDENCY_UNAVAILABLE"


def test_ops_routes_reject_a_wrong_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_secret", "correct-secret")
    assert client.post("/api/v1/ops/bootstrap").status_code == 403
    assert (
        client.post(
            "/api/v1/ops/bootstrap", headers={"Authorization": "Bearer wrong-secret"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/ops/bootstrap", headers={"X-Bootstrap-Secret": "wrong-secret"}
        ).status_code
        == 403
    )


def test_bootstrap_is_idempotent(client, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_secret", "correct-secret")
    headers = {"Authorization": "Bearer correct-secret"}

    first = client.post("/api/v1/ops/bootstrap", headers=headers)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["schema"] == "ready"
    # The fixture database is already seeded, so bootstrap must not duplicate it.
    assert body["seed"]["status"] == "skipped"
    assert body["counts"]["institutions"] == 4

    second = client.post("/api/v1/ops/bootstrap", headers=headers)
    assert second.json()["counts"] == body["counts"]


def test_scheduled_scan_runs_and_stays_idempotent(client, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_secret", "correct-secret")
    headers = {"Authorization": "Bearer correct-secret"}

    first = client.get("/api/v1/ops/cron/maturity-scan", headers=headers)
    assert first.status_code == 200, first.text
    second = client.get("/api/v1/ops/cron/maturity-scan", headers=headers)
    assert second.json()["maturity_scan"]["created"] == 0


def test_health_is_reachable_under_the_api_prefix(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert client.get("/health").json()["status"] == "ok"
