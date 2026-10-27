"""Deterministic integrity engine.

It produces explainable findings with evidence references, never a fraud score
and never an automated accusation. Findings are re-evaluated when evidence
changes; a resolved or false-positive disposition is preserved with its reason.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import as_utc, new_id, utcnow
from app.db.models import (
    ClearanceRequirement,
    Fdr,
    FdrDocument,
    FdrExtraction,
    Finding,
    ReleaseRequest,
    VerificationCheck,
)

RULES_PATH = Path(__file__).with_name("rules.yaml")


@dataclass(frozen=True)
class RuleCatalog:
    name: str
    version: str
    sha256: str
    thresholds: dict[str, int]
    rules: dict[str, dict[str, Any]]


@lru_cache
def load_catalog() -> RuleCatalog:
    raw = RULES_PATH.read_bytes()
    parsed = yaml.safe_load(raw)
    return RuleCatalog(
        name=parsed["ruleset_name"],
        version=str(parsed["version"]),
        sha256=hashlib.sha256(raw).hexdigest(),
        thresholds={k: int(v) for k, v in parsed.get("thresholds", {}).items()},
        rules={rule["id"]: rule for rule in parsed["rules"]},
    )


@dataclass
class EvaluatedFinding:
    rule_id: str
    evidence: dict[str, Any] = field(default_factory=dict)
    explanation: str = ""
    release_request_id: str | None = None


def _as_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return None


def evaluate_fdr(
    db: Session, fdr: Fdr, *, today: date | None = None
) -> list[EvaluatedFinding]:
    """Pure-ish evaluation: reads evidence, returns findings, writes nothing."""
    catalog = load_catalog()
    today = today or datetime.now(timezone.utc).date()
    results: list[EvaluatedFinding] = []

    documents = list(
        db.scalars(select(FdrDocument).where(FdrDocument.fdr_id == fdr.id))
    )
    clean_documents = [d for d in documents if d.scan_status == "CLEAN"]
    latest_extraction = None
    if clean_documents:
        latest_extraction = db.scalar(
            select(FdrExtraction)
            .where(FdrExtraction.document_id.in_([d.id for d in clean_documents]))
            .order_by(FdrExtraction.created_at.desc())
            .limit(1)
        )

    submitted = fdr.submission_status == "SUBMITTED"

    # --- Evidence availability -------------------------------------------------
    if submitted and not clean_documents:
        results.append(
            EvaluatedFinding(
                "DOC-001",
                {"documents_on_record": str(len(documents))},
                "The instrument was submitted but no document has passed security scanning.",
            )
        )
    if any(
        d.scan_status == "QUARANTINED"
        or d.processing_status in {"QUEUED", "EXTRACTING"}
        for d in documents
    ):
        results.append(
            EvaluatedFinding(
                "DOC-002",
                {
                    "documents_pending": str(
                        len(
                            [
                                d
                                for d in documents
                                if d.processing_status in {"QUEUED", "EXTRACTING"}
                            ]
                        )
                    )
                },
                "A document is still being scanned or parsed, so evidence is incomplete.",
            )
        )

    # --- Document versus declared values --------------------------------------
    if latest_extraction:
        extracted = json.loads(latest_extraction.extracted_json)
        confidence = json.loads(latest_extraction.confidence_json)

        extracted_amount = _as_decimal(extracted.get("principal_amount"))
        maturity_value = _as_decimal(extracted.get("maturity_amount"))
        from app.domains.documents.extraction import maturity_value_check

        consistency = maturity_value_check(extracted)
        if consistency and not consistency["consistent"]:
            results.append(
                EvaluatedFinding(
                    "DATA-005",
                    {**consistency, "document_id": latest_extraction.document_id},
                    "The stated maturity value differs from a simple-interest estimate by more than 1%. Confirm day-count, tax and deposit terms; this estimate is not a bank valuation.",
                )
            )
        if (
            maturity_value is not None
            and extracted_amount is not None
            and maturity_value < extracted_amount
        ):
            results.append(
                EvaluatedFinding(
                    "DATA-004",
                    {
                        "principal": str(extracted_amount),
                        "maturity_value": str(maturity_value),
                        "document_id": latest_extraction.document_id,
                    },
                    "The stated maturity value is below principal. Review the source document and deposit terms; this is not proof of misconduct.",
                )
            )
        if extracted_amount is not None and extracted_amount != _as_decimal(
            fdr.principal_amount
        ):
            results.append(
                EvaluatedFinding(
                    "DATA-001",
                    {
                        "declared_principal": str(fdr.principal_amount),
                        "document_principal": str(extracted_amount),
                        "document_id": latest_extraction.document_id,
                    },
                    "The principal the institution declared does not match the parsed document "
                    "value. This is an inconsistency to resolve, not evidence of forgery.",
                )
            )

        extracted_maturity = extracted.get("maturity_date")
        if extracted_maturity and extracted_maturity != fdr.maturity_date.isoformat():
            results.append(
                EvaluatedFinding(
                    "DATA-003",
                    {
                        "declared_maturity": fdr.maturity_date.isoformat(),
                        "document_maturity": str(extracted_maturity),
                        "document_id": latest_extraction.document_id,
                    },
                    "The declared maturity date differs from the date parsed from the document.",
                )
            )

        for field_name in ("issue_date", "maturity_date"):
            if (
                extracted.get(field_name) is None
                or confidence.get(field_name, 0) < 0.85
            ):
                results.append(
                    EvaluatedFinding(
                        "DATA-002",
                        {
                            "field": field_name,
                            "confidence": str(confidence.get(field_name, 0)),
                            "document_id": latest_extraction.document_id,
                        },
                        f"The {field_name.replace('_', ' ')} could not be read reliably "
                        "from the document.",
                    )
                )
                break

    # --- Verification evidence -------------------------------------------------
    bank_checks = list(
        db.scalars(
            select(VerificationCheck)
            .where(
                VerificationCheck.fdr_id == fdr.id,
                VerificationCheck.source_kind.in_(["MOCK_BANK", "AUTHORIZED_BANK"]),
            )
            .order_by(VerificationCheck.performed_at.desc())
        )
    )
    if submitted and not bank_checks:
        results.append(
            EvaluatedFinding(
                "VERIFY-001",
                {"bank_verification_status": fdr.bank_verification_status},
                "No bank-source check has been recorded for this instrument.",
            )
        )
    elif bank_checks:
        latest = bank_checks[0]
        detail = json.loads(latest.detail_json or "{}")
        lien_claim = detail.get("lien_claim")
        if (
            lien_claim
            and lien_claim.startswith("NOT_CONFIRMED")
            and fdr.lien_beneficiary
        ):
            results.append(
                EvaluatedFinding(
                    "VERIFY-002",
                    {
                        "declared_lien_beneficiary": fdr.lien_beneficiary,
                        "bank_source_lien_claim": lien_claim,
                        "source_kind": latest.source_kind,
                        "scenario_id": latest.scenario_id or "",
                    },
                    "The bank-source response does not confirm the declared lien. "
                    "The source is simulated, so escalate rather than conclude.",
                )
            )
        expires_at = as_utc(latest.expires_at)
        if expires_at and expires_at < utcnow():
            results.append(
                EvaluatedFinding(
                    "VERIFY-003",
                    {
                        "checked_at": as_utc(latest.performed_at).isoformat(),
                        "expired_at": expires_at.isoformat(),
                    },
                    "The most recent verification evidence has passed its validity window.",
                )
            )

    # --- Deadlines -------------------------------------------------------------
    days_remaining = (fdr.maturity_date - today).days
    unresolved = fdr.instrument_status in {"REGISTERED", "ACTIVE"}
    if unresolved and 0 <= days_remaining <= catalog.thresholds.get(
        "maturity_warning_days", 30
    ):
        results.append(
            EvaluatedFinding(
                "MAT-001",
                {
                    "days_remaining": str(days_remaining),
                    "maturity_date": fdr.maturity_date.isoformat(),
                    "assigned_officer_id": fdr.assigned_officer_id or "unassigned",
                },
                f"The instrument matures in {days_remaining} day(s) with no resolved action.",
            )
        )
    if unresolved and days_remaining < 0:
        results.append(
            EvaluatedFinding(
                "MAT-002",
                {
                    "days_overdue": str(abs(days_remaining)),
                    "maturity_date": fdr.maturity_date.isoformat(),
                },
                f"Maturity passed {abs(days_remaining)} day(s) ago and no action is recorded.",
            )
        )

    # --- Duplicate candidates --------------------------------------------------
    duplicates = list(
        db.scalars(
            select(Fdr).where(
                Fdr.fdr_lookup_hash == fdr.fdr_lookup_hash, Fdr.id != fdr.id
            )
        )
    )
    if duplicates:
        results.append(
            EvaluatedFinding(
                "DUP-001",
                {
                    "candidate_count": str(len(duplicates)),
                    "candidate_ids": ",".join(d.id for d in duplicates[:5]),
                },
                "Another instrument resolves to the same issuer and number token. "
                "Bank number formats can collide, so this needs manual investigation.",
            )
        )

    # --- Release-case policy ---------------------------------------------------
    release = db.scalar(
        select(ReleaseRequest)
        .where(
            ReleaseRequest.fdr_id == fdr.id,
            ReleaseRequest.status.notin_(["CLOSED", "REJECTED"]),
        )
        .order_by(ReleaseRequest.created_at.desc())
        .limit(1)
    )
    if release:
        pending = list(
            db.scalars(
                select(ClearanceRequirement).where(
                    ClearanceRequirement.request_id == release.id,
                    ClearanceRequirement.required.is_(True),
                    ClearanceRequirement.state != "CLEARED",
                )
            )
        )
        if pending:
            results.append(
                EvaluatedFinding(
                    "CASE-001",
                    {
                        "request_id": release.id,
                        "pending_clearances": ",".join(c.bureau_code for c in pending),
                    },
                    "The release request cannot be finally approved while a required "
                    "clearance is outstanding.",
                    release_request_id=release.id,
                )
            )
        if fdr.review_status != "ACCEPTED":
            results.append(
                EvaluatedFinding(
                    "POLICY-001",
                    {"request_id": release.id, "review_status": fdr.review_status},
                    "A release was requested for an instrument that scrutiny has not accepted.",
                    release_request_id=release.id,
                )
            )

    return results


def sync_findings(
    db: Session, fdr: Fdr, *, today: date | None = None
) -> dict[str, int]:
    """Reconcile stored findings with a fresh evaluation.

    Dispositions survive: a finding marked false positive is not re-opened
    unless its evidence changed, and a finding that no longer fires is resolved
    by the system rather than deleted.
    """
    catalog = load_catalog()
    evaluated = {
        finding.rule_id: finding for finding in evaluate_fdr(db, fdr, today=today)
    }
    existing = {
        finding.rule_id: finding
        for finding in db.scalars(select(Finding).where(Finding.fdr_id == fdr.id))
    }
    stats = {"opened": 0, "updated": 0, "auto_resolved": 0, "reopened": 0}

    for rule_id, evaluation in evaluated.items():
        rule = catalog.rules[rule_id]
        evidence_json = json.dumps(evaluation.evidence, sort_keys=True)
        current = existing.get(rule_id)
        if current is None:
            db.add(
                Finding(
                    id=new_id(),
                    fdr_id=fdr.id,
                    release_request_id=evaluation.release_request_id,
                    rule_id=rule_id,
                    rule_version=f"{catalog.version}+{catalog.sha256[:8]}",
                    category=rule["category"],
                    severity=rule["severity"],
                    title=rule["title"],
                    explanation=evaluation.explanation,
                    recommended_action=rule["recommended_action"],
                    evidence_json=evidence_json,
                    status="OPEN",
                    detected_at=utcnow(),
                )
            )
            stats["opened"] += 1
            continue

        evidence_changed = current.evidence_json != evidence_json
        current.evidence_json = evidence_json
        current.explanation = evaluation.explanation
        current.release_request_id = evaluation.release_request_id
        if (
            current.status in {"RESOLVED", "FALSE_POSITIVE", "AUTO_RESOLVED"}
            and evidence_changed
        ):
            current.status = "OPEN"
            current.disposition_reason = (
                "Re-opened automatically: the underlying evidence changed."
            )
            stats["reopened"] += 1
        else:
            stats["updated"] += 1

    for rule_id, current in existing.items():
        if rule_id not in evaluated and current.status == "OPEN":
            current.status = "AUTO_RESOLVED"
            current.disposition_reason = (
                "No longer detected by the current rule evaluation."
            )
            stats["auto_resolved"] += 1

    return stats


ATTENTION_ORDER = {
    "BLOCKER": 0,
    "CRITICAL": 1,
    "HIGH": 2,
    "MEDIUM": 3,
    "ATTENTION": 4,
    "LOW": 5,
}


def attention_level(severities: list[str]) -> str:
    """Work-priority bucket derived from a documented table, not a predictor."""
    if not severities:
        return "ROUTINE"
    best = min(severities, key=lambda s: ATTENTION_ORDER.get(s, 9))
    if best in {"BLOCKER", "CRITICAL"}:
        return "CRITICAL"
    if best == "HIGH":
        return "HIGH"
    return "ROUTINE"
