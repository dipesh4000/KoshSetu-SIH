"""Bank verification port.

Two source kinds exist and they are not interchangeable. The mock provider can
only ever produce MOCK_* outcomes; AUTHENTICATED_EXTERNAL is reachable solely
through an authorized adapter that this project does not ship.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Protocol


class VerificationSource(StrEnum):
    MOCK_BANK = "MOCK_BANK"
    AUTHORIZED_BANK = "AUTHORIZED_BANK"


class BankOutcome(StrEnum):
    MOCK_MATCH = "MOCK_MATCH"
    MOCK_MISMATCH = "MOCK_MISMATCH"
    MOCK_NOT_FOUND = "MOCK_NOT_FOUND"
    MOCK_TIMEOUT = "MOCK_TIMEOUT"
    MOCK_SERVICE_ERROR = "MOCK_SERVICE_ERROR"
    AUTHENTICATED_EXTERNAL = "AUTHENTICATED_EXTERNAL"
    EXTERNAL_UNAVAILABLE = "EXTERNAL_UNAVAILABLE"


@dataclass(frozen=True)
class InstrumentClaim:
    fdr_number: str
    issuer_bank: str
    principal_amount: str
    issue_date: str
    maturity_date: str
    lien_beneficiary: str | None = None


@dataclass(frozen=True)
class BankVerificationResult:
    response_id: str
    source_kind: VerificationSource
    scenario_id: str
    environment: str
    verification_status: BankOutcome
    match_results: dict[str, str]
    lien_claim: str | None
    checked_at: datetime
    expires_at: datetime | None
    evidence_hash: str
    signature: str
    signature_valid: bool
    is_simulated: bool
    message: str
    detail: dict[str, Any] = field(default_factory=dict)


class BankVerifier(Protocol):
    def verify(
        self,
        *,
        instrument_ref: str,
        claim: InstrumentClaim,
        requested_checks: list[str],
        correlation_id: str,
        scenario_id: str | None = None,
    ) -> BankVerificationResult: ...


class AuthorizedBankVerifier:
    """Placeholder for the real connector.

    It stays unimplemented on purpose: a live connector needs a signed
    agreement, mTLS or equivalent channel security, network allow-listing and
    an approved data-handling review before any code is useful.
    """

    def verify(self, **_: Any) -> BankVerificationResult:  # pragma: no cover
        raise NotImplementedError(
            "No authorized bank integration exists for this prototype. "
            "AUTHENTICATED_EXTERNAL cannot be produced."
        )
