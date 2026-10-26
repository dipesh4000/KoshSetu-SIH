"""Unit checks on the invariants the brief treats as non-negotiable."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.security import lookup_hash, mask_fdr_number, sign_payload, verify_password, hash_password
from app.db.models import Fdr
from app.domains.bank.mock_adapter import SCENARIOS, MockBankUnavailable, MockBankVerifier
from app.domains.bank.ports import BankOutcome, InstrumentClaim, VerificationSource
from app.domains.notifications.scheduler import run_maturity_scan
from app.domains.risk.engine import attention_level, evaluate_fdr, load_catalog


def _claim(number: str = "SBI/FDR/2024/778231") -> InstrumentClaim:
    return InstrumentClaim(
        fdr_number=number,
        issuer_bank="State Bank of India",
        principal_amount="2500000.00",
        issue_date="2024-11-07",
        maturity_date="2026-11-07",
        lien_beneficiary="AICTE, New Delhi",
    )


def test_password_hash_roundtrip():
    stored = hash_password("Demo@12345")
    assert verify_password("Demo@12345", stored)
    assert not verify_password("wrong-password", stored)
    assert "Demo@12345" not in stored


def test_fdr_number_is_masked_and_hashed_consistently():
    assert mask_fdr_number("SBI/FDR/2024/778231").endswith("8231")
    assert "778231" not in mask_fdr_number("SBI/FDR/2024/778231")[:-4]
    # Formatting differences normalise to the same lookup token.
    assert lookup_hash("State Bank of India", "SBI-FDR-2024-778231") == lookup_hash(
        "state bank of india", "sbi/fdr/2024/778231"
    )


@pytest.mark.parametrize("scenario", sorted(SCENARIOS))
def test_mock_adapter_never_claims_external_authentication(scenario: str):
    result = MockBankVerifier(enabled=True, environment="DEMO").verify(
        instrument_ref="fdr-test",
        claim=_claim(),
        requested_checks=["AMOUNT"],
        correlation_id="corr-test",
        scenario_id=scenario,
    )
    assert result.source_kind is VerificationSource.MOCK_BANK
    assert result.is_simulated is True
    assert result.verification_status is not BankOutcome.AUTHENTICATED_EXTERNAL
    assert result.verification_status.value.startswith("MOCK_")


def test_tampered_mock_signature_is_detected():
    result = MockBankVerifier(enabled=True).verify(
        instrument_ref="fdr-test",
        claim=_claim(),
        requested_checks=["AMOUNT"],
        correlation_id="corr-test",
        scenario_id="INVALID_SIGNATURE",
    )
    assert result.signature_valid is False
    assert result.detail["rejected_reason"] == "SIGNATURE_INVALID"


def test_replayed_mock_response_is_detected():
    verifier = MockBankVerifier(enabled=True)
    first = verifier.verify(
        instrument_ref="fdr-test",
        claim=_claim(),
        requested_checks=["AMOUNT"],
        correlation_id="corr-1",
        scenario_id="REPLAYED_RESPONSE",
    )
    second = verifier.verify(
        instrument_ref="fdr-test",
        claim=_claim(),
        requested_checks=["AMOUNT"],
        correlation_id="corr-2",
        scenario_id="REPLAYED_RESPONSE",
    )
    assert first.response_id == second.response_id
    assert second.detail["rejected_reason"] == "RESPONSE_REPLAYED"


def test_disabled_provider_reports_unavailable_rather_than_success():
    with pytest.raises(MockBankUnavailable):
        MockBankVerifier(enabled=False).verify(
            instrument_ref="fdr-test",
            claim=_claim(),
            requested_checks=["AMOUNT"],
            correlation_id="corr-test",
        )


def test_mock_signature_is_stable_for_the_same_payload():
    assert sign_payload("payload") == sign_payload("payload")
    assert sign_payload("payload") != sign_payload("payload2")


def test_amount_mismatch_is_a_finding_not_a_fraud_verdict(db):
    fdr = db.scalar(select(Fdr).where(Fdr.issuer_bank == "Canara Bank"))
    assert fdr is not None
    rule_ids = {finding.rule_id for finding in evaluate_fdr(db, fdr)}
    assert "DATA-001" in rule_ids
    assert not any("FRAUD" in rule_id for rule_id in rule_ids)


def test_maturity_window_raises_a_deadline_finding(db):
    fdr = db.scalar(select(Fdr).where(Fdr.issuer_bank == "Bank of Baroda"))
    findings = {finding.rule_id for finding in evaluate_fdr(db, fdr)}
    assert "MAT-001" in findings
    assert "VERIFY-001" in findings


def test_overdue_instrument_raises_critical_deadline_finding(db):
    fdr = db.scalar(select(Fdr).where(Fdr.issuer_bank == "Punjab National Bank"))
    findings = {finding.rule_id for finding in evaluate_fdr(db, fdr)}
    assert "MAT-002" in findings


def test_rule_catalog_is_versioned_and_hashed():
    catalog = load_catalog()
    assert catalog.version
    assert len(catalog.sha256) == 64
    assert "DATA-001" in catalog.rules


def test_attention_level_is_derived_from_a_documented_table():
    assert attention_level(["BLOCKER"]) == "CRITICAL"
    assert attention_level(["HIGH", "MEDIUM"]) == "HIGH"
    assert attention_level(["MEDIUM"]) == "ROUTINE"
    assert attention_level([]) == "ROUTINE"


def test_repeated_maturity_scan_creates_no_duplicate_reminder(db):
    first = run_maturity_scan(db)
    second = run_maturity_scan(db)
    assert second["created"] == 0
    assert second["skipped_duplicates"] >= first["skipped_duplicates"]


def test_managed_database_urls_are_normalised():
    from app.core.config import normalise_database_url

    assert normalise_database_url("postgres://u:p@host/db") == (
        "postgresql+psycopg://u:p@host/db?sslmode=require"
    )
    assert normalise_database_url("postgresql://u:p@host/db?sslmode=require") == (
        "postgresql+psycopg://u:p@host/db?sslmode=require"
    )
    # A local SQLite URL is left exactly as it is.
    assert normalise_database_url("sqlite:///./data/x.db") == "sqlite:///./data/x.db"


def test_serverless_runtime_refuses_a_disappearing_store(monkeypatch):
    """The settings gate must fail loudly rather than lose uploads."""
    from app.core.config import Settings, get_settings

    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("KOSHSETU_STORAGE_BACKEND", "filesystem")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="no durable filesystem"):
            get_settings()
    finally:
        get_settings.cache_clear()
    assert Settings  # imported for the symbol check above


def test_hosted_environment_refuses_development_secrets(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("KOSHSETU_ENVIRONMENT", "demo")
    monkeypatch.setenv("KOSHSETU_JWT_SECRET", "insecure-local-development-secret")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="before deploying"):
            get_settings()
    finally:
        get_settings.cache_clear()
