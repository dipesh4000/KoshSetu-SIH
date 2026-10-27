"""Regressions for session, authorization, encryption and complete audit digests."""

import base64
from dataclasses import replace

import pytest
from cryptography.exceptions import InvalidTag
from sqlalchemy import select

from app.api.deps import build_principal, scoped_fdr_query
from app.core.config import settings
from app.core.security import deobfuscate_store, obfuscate_store
from app.db.models import User
from app.domains.audit.service import record_audit, verify_chain


def test_authenticated_encryption_detects_tampering():
    first, second = obfuscate_store("SBI/12345678"), obfuscate_store("SBI/12345678")
    assert first != second
    assert deobfuscate_store(first) == "SBI/12345678"
    prefix, payload = first.rsplit(":", 1)
    raw = bytearray(base64.b64decode(payload))
    raw[-1] ^= 1
    with pytest.raises(InvalidTag):
        deobfuscate_store(prefix + ":" + base64.b64encode(raw).decode())


def test_key_rotation_preserves_readability(monkeypatch):
    old = obfuscate_store("ROTATION-123")
    old_key, old_id = (
        settings.encryption_key or settings.fdr_hmac_key,
        settings.encryption_key_id,
    )
    monkeypatch.setattr(settings, "encryption_key_id", "rotated-v2")
    monkeypatch.setattr(
        settings, "encryption_key", "synthetic-rotated-key-material-for-test-only"
    )
    monkeypatch.setattr(settings, "encryption_previous_keys", {old_id: old_key})
    assert deobfuscate_store(old) == "ROTATION-123"
    assert obfuscate_store("ROTATION-123").startswith("v2:rotated-v2:")


def test_copied_token_is_revoked_after_logout(as_user, client):
    signed = as_user("scrutiny@aicte.demo")
    token = signed.cookies.get("koshsetu_session")
    assert signed.post("/api/v1/auth/logout").status_code == 204
    assert (
        client.get(
            "/api/v1/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 401
    )


def test_no_region_and_no_explicit_global_assignment_fails_closed(db):
    user = db.scalar(select(User).where(User.email == "scrutiny@aicte.demo"))
    principal = replace(build_principal(db, user), region_codes=frozenset(), labels={})
    assert list(db.scalars(scoped_fdr_query(principal))) == []


def test_login_throttle_applies_to_unknown_accounts(client, monkeypatch):
    monkeypatch.setattr(settings, "login_account_limit", 2)
    body = {"email": "rate-test@missing.demo", "password": "wrong-password"}
    assert client.post("/api/v1/auth/login", json=body).status_code == 401
    assert client.post("/api/v1/auth/login", json=body).status_code == 401
    response = client.post("/api/v1/auth/login", json=body)
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


@pytest.mark.parametrize(
    "field", ["reason", "request_id", "actor_label", "previous_digest", "aggregate_id"]
)
def test_complete_audit_digest_detects_field_tampering(db, field):
    event = record_audit(
        db,
        aggregate_type="test",
        aggregate_id="digest-test",
        action="test.integrity",
        reason="original",
        request_id="request-original",
    )
    db.flush()
    assert verify_chain(db)["verified"]
    setattr(event, field, "tampered")
    db.flush()
    assert not verify_chain(db)["verified"]
    db.rollback()


def test_auditor_cannot_trigger_operational_writes(as_user):
    auditor = as_user("auditor@aicte.demo")
    for route in ("/ops/maturity-scan", "/ops/dispatch-outbox"):
        assert auditor.post("/api/v1" + route).status_code == 403
