"""Deterministic bank simulator.

Every response is tagged MOCK_BANK, signed by the simulator's own key and
recorded with a replay guard. A valid signature authenticates the *simulator*
and nothing else: it is not evidence about a real instrument or a real bank.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from app.core.config import settings
from app.core.security import sha256_bytes, sign_payload
from app.domains.bank.ports import (
    BankOutcome,
    BankVerificationResult,
    InstrumentClaim,
    VerificationSource,
)

SCENARIOS: dict[str, dict[str, str]] = {
    "MATCH_WITH_ACTIVE_LIEN": {
        "outcome": BankOutcome.MOCK_MATCH,
        "lien": "ACTIVE_SIMULATED",
        "message": "Simulated bank record matches all requested fields.",
    },
    "AMOUNT_MISMATCH": {
        "outcome": BankOutcome.MOCK_MISMATCH,
        "lien": "ACTIVE_SIMULATED",
        "message": "Simulated bank record reports a different principal amount.",
    },
    "MATURITY_MISMATCH": {
        "outcome": BankOutcome.MOCK_MISMATCH,
        "lien": "ACTIVE_SIMULATED",
        "message": "Simulated bank record reports a different maturity date.",
    },
    "INSTRUMENT_NOT_FOUND": {
        "outcome": BankOutcome.MOCK_NOT_FOUND,
        "lien": "UNKNOWN",
        "message": "No simulated record for this reference. This is not a finding of fraud.",
    },
    "LIEN_MISSING": {
        "outcome": BankOutcome.MOCK_MISMATCH,
        "lien": "NOT_CONFIRMED_SIMULATED",
        "message": "Simulated bank record carries no lien in favour of the declared beneficiary.",
    },
    "PROVIDER_TIMEOUT": {
        "outcome": BankOutcome.MOCK_TIMEOUT,
        "lien": "UNKNOWN",
        "message": "Simulated provider did not respond within the timeout budget.",
    },
    "INVALID_SIGNATURE": {
        "outcome": BankOutcome.MOCK_SERVICE_ERROR,
        "lien": "UNKNOWN",
        "message": "Simulated response failed signature validation and was rejected.",
    },
    "REPLAYED_RESPONSE": {
        "outcome": BankOutcome.MOCK_SERVICE_ERROR,
        "lien": "UNKNOWN",
        "message": "Simulated response reused an earlier response id and was rejected.",
    },
}

REQUESTABLE_CHECKS = ("NUMBER", "AMOUNT", "MATURITY_DATE", "ISSUE_DATE", "LIEN_STATUS")

_seen_response_ids: set[str] = set()


class MockBankUnavailable(RuntimeError):
    pass


class MockBankVerifier:
    """Fixture-driven verifier.

    `scenario_id` is an explicit demonstration control. It is never exposed to
    institutions and never available outside a demo environment.
    """

    source = VerificationSource.MOCK_BANK

    def __init__(self, *, enabled: bool | None = None, environment: str | None = None) -> None:
        self.enabled = settings.mock_bank_enabled if enabled is None else enabled
        self.environment = (environment or settings.environment).upper()

    def _derive_scenario(self, claim: InstrumentClaim) -> str:
        """Pick a deterministic scenario from the claim when none is forced."""
        seed = int(sha256_bytes(claim.fdr_number.encode())[:8], 16)
        if claim.lien_beneficiary is None:
            return "LIEN_MISSING"
        ordered = [
            "MATCH_WITH_ACTIVE_LIEN",
            "MATCH_WITH_ACTIVE_LIEN",
            "MATCH_WITH_ACTIVE_LIEN",
            "AMOUNT_MISMATCH",
            "MATURITY_MISMATCH",
            "INSTRUMENT_NOT_FOUND",
        ]
        return ordered[seed % len(ordered)]

    def verify(
        self,
        *,
        instrument_ref: str,
        claim: InstrumentClaim,
        requested_checks: list[str],
        correlation_id: str,
        scenario_id: str | None = None,
    ) -> BankVerificationResult:
        if not self.enabled:
            raise MockBankUnavailable(
                "Bank verification is disabled in this environment. No authorized "
                "bank integration is configured."
            )
        if settings.is_production:  # pragma: no cover - blocked by settings gate too
            raise MockBankUnavailable("The simulator cannot run in production.")

        scenario = scenario_id or self._derive_scenario(claim)
        if scenario not in SCENARIOS:
            raise ValueError(f"Unknown simulation scenario: {scenario}")
        fixture = SCENARIOS[scenario]
        checks = [c for c in requested_checks if c in REQUESTABLE_CHECKS] or list(
            REQUESTABLE_CHECKS
        )

        now = datetime.now(timezone.utc)
        simulated_amount = Decimal(claim.principal_amount)
        match_results: dict[str, str] = {}
        detail: dict[str, object] = {}

        if scenario == "AMOUNT_MISMATCH":
            simulated_amount = (simulated_amount * Decimal("0.8")).quantize(Decimal("0.01"))
            detail["simulated_principal_amount"] = str(simulated_amount)
        if scenario == "MATURITY_MISMATCH":
            detail["simulated_maturity_date"] = claim.maturity_date[:8] + "01"

        for check in checks:
            if scenario == "MATCH_WITH_ACTIVE_LIEN":
                match_results[check] = "MATCH"
            elif scenario == "INSTRUMENT_NOT_FOUND":
                match_results[check] = "NO_RECORD"
            elif scenario in {"PROVIDER_TIMEOUT", "INVALID_SIGNATURE", "REPLAYED_RESPONSE"}:
                match_results[check] = "UNKNOWN"
            elif scenario == "AMOUNT_MISMATCH":
                match_results[check] = "MISMATCH" if check == "AMOUNT" else "MATCH"
            elif scenario == "MATURITY_MISMATCH":
                match_results[check] = "MISMATCH" if check == "MATURITY_DATE" else "MATCH"
            elif scenario == "LIEN_MISSING":
                match_results[check] = "MISMATCH" if check == "LIEN_STATUS" else "MATCH"

        response_id = (
            "mock-resp-replayed-fixture"
            if scenario == "REPLAYED_RESPONSE"
            else f"mock-resp-{uuid4()}"
        )
        envelope = {
            "response_id": response_id,
            "source_kind": VerificationSource.MOCK_BANK.value,
            "scenario_id": scenario,
            "environment": self.environment,
            "instrument_ref": instrument_ref,
            "correlation_id": correlation_id,
            "verification_status": fixture["outcome"],
            "match_results": match_results,
            "lien_claim": fixture["lien"],
            "checked_at": now.isoformat(),
        }
        serialised = json.dumps(envelope, sort_keys=True)
        evidence_hash = f"sha256:{sha256_bytes(serialised.encode())}"
        signature = sign_payload(serialised)

        signature_valid = True
        outcome = BankOutcome(fixture["outcome"])
        message = fixture["message"]

        if scenario == "INVALID_SIGNATURE":
            signature = "tampered-" + signature[9:]
            signature_valid = sign_payload(serialised) == signature
            detail["rejected_reason"] = "SIGNATURE_INVALID"
        elif scenario == "REPLAYED_RESPONSE":
            if response_id in _seen_response_ids:
                detail["rejected_reason"] = "RESPONSE_REPLAYED"
            else:
                _seen_response_ids.add(response_id)
                detail["rejected_reason"] = "RESPONSE_REPLAYED"
        else:
            _seen_response_ids.add(response_id)

        if outcome is BankOutcome.AUTHENTICATED_EXTERNAL:  # pragma: no cover - guard
            raise ValueError("The simulator must never return AUTHENTICATED_EXTERNAL")

        return BankVerificationResult(
            response_id=response_id,
            source_kind=VerificationSource.MOCK_BANK,
            scenario_id=scenario,
            environment=self.environment,
            verification_status=outcome,
            match_results=match_results,
            lien_claim=fixture["lien"],
            checked_at=now,
            expires_at=now + timedelta(hours=24),
            evidence_hash=evidence_hash,
            signature=signature,
            signature_valid=signature_valid,
            is_simulated=True,
            message=message,
            detail=detail,
        )


def get_verifier() -> MockBankVerifier:
    return MockBankVerifier()
