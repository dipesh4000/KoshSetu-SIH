"""Typed request and response contracts.

Money is a Decimal serialised as a string so no value ever passes through a
binary float, and the status dimensions stay separate fields.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, model_validator

T = TypeVar("T")


class Meta(BaseModel):
    request_id: str
    as_of: datetime
    environment: str
    bank_provider: str
    is_simulated_environment: bool


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


class ErrorBody(BaseModel):
    code: str
    message: str
    field_errors: dict[str, str] = Field(default_factory=dict)
    request_id: str | None = None
    retryable: bool | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorBody


# --- auth ---------------------------------------------------------------------


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class SessionOut(BaseModel):
    user_id: str
    email: str
    display_name: str
    roles: list[str]
    capabilities: list[str]
    institution_ids: list[str]
    region_codes: list[str]
    bureau_codes: list[str]
    mfa_enrolled: bool
    workspace: str
    csrf_token: str | None = None


class InstitutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    aicte_id: str
    name: str
    region_code: str
    state: str
    status: str
    legal_holder_name: str | None = None


# --- instruments --------------------------------------------------------------


class FdrDraftIn(BaseModel):
    issuer_bank: str = Field(min_length=3, max_length=120)
    branch: str | None = Field(default=None, max_length=120)
    ifsc: str | None = Field(default=None, pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    fdr_number: str = Field(min_length=4, max_length=80)
    principal_amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    interest_rate: Decimal | None = Field(default=None, ge=0, le=99, decimal_places=2)
    issue_date: date
    maturity_date: date
    lien_beneficiary: str | None = Field(default=None, max_length=180)

    @model_validator(mode="after")
    def _dates_in_order(self) -> "FdrDraftIn":
        if self.maturity_date < self.issue_date:
            raise ValueError("maturity_date cannot be before issue_date")
        if self.issue_date > date.today():
            raise ValueError("issue_date cannot be in the future")
        return self

    @field_serializer("principal_amount", "interest_rate")
    def _decimal_as_string(self, value: Decimal | None) -> str | None:
        return None if value is None else f"{value}"


class FdrDraftPatch(BaseModel):
    issuer_bank: str | None = Field(default=None, min_length=3, max_length=120)
    branch: str | None = Field(default=None, max_length=120)
    ifsc: str | None = Field(default=None, pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    fdr_number: str | None = Field(default=None, min_length=4, max_length=80)
    principal_amount: Decimal | None = Field(default=None, gt=0, max_digits=18, decimal_places=2)
    interest_rate: Decimal | None = Field(default=None, ge=0, le=99, decimal_places=2)
    issue_date: date | None = None
    maturity_date: date | None = None
    lien_beneficiary: str | None = Field(default=None, max_length=180)


class StatusBlock(BaseModel):
    submission_status: str
    document_processing_status: str
    bank_verification_status: str
    review_status: str
    instrument_status: str
    lien_status: str


class FdrListItem(BaseModel):
    id: str
    institution_id: str
    institution_name: str
    aicte_id: str
    region_code: str
    issuer_bank: str
    fdr_number_masked: str
    principal_amount: str
    currency: str
    issue_date: date
    maturity_date: date
    days_remaining: int
    is_maturing: bool
    status: StatusBlock
    assigned_officer_id: str | None
    attention_level: str
    open_finding_count: int
    version: int
    updated_at: datetime


class ExtractedFieldOut(BaseModel):
    field: str
    declared_value: str | None
    extracted_value: str | None
    extracted_raw: str | None
    confidence: float
    page_index: int | None
    bbox: list[float] | None
    difference: str  # MATCH | DIFFERS | NOT_FOUND | NOT_COMPARABLE


class DocumentOut(BaseModel):
    id: str
    document_type: str
    original_filename: str
    content_type: str
    size_bytes: int
    sha256: str
    scan_status: str
    scan_detail: str | None
    processing_status: str
    version: int
    uploaded_at: datetime
    is_viewable: bool


class VerificationCheckOut(BaseModel):
    id: str
    check_type: str
    source_kind: str
    scenario_id: str | None
    result: str
    is_simulated: bool
    message: str | None
    match_results: dict[str, str] = Field(default_factory=dict)
    lien_claim: str | None = None
    response_hash: str | None
    correlation_id: str | None
    performed_at: datetime
    expires_at: datetime | None
    provenance_note: str


class FindingOut(BaseModel):
    id: str
    fdr_id: str
    rule_id: str
    rule_version: str
    category: str
    severity: str
    title: str
    explanation: str
    recommended_action: str
    evidence: dict[str, Any]
    status: str
    disposition_reason: str | None
    detected_at: datetime
    institution_name: str | None = None
    fdr_number_masked: str | None = None


class AuditEventOut(BaseModel):
    id: str
    aggregate_type: str
    aggregate_id: str
    actor_label: str
    action: str
    outcome: str
    reason: str | None
    old_state_summary: str | None
    new_state_summary: str | None
    request_id: str | None
    integrity_digest: str
    occurred_at: datetime


class ReviewDecisionOut(BaseModel):
    id: str
    decision: str
    reason: str
    actor_label: str
    created_at: datetime


class LinkOut(BaseModel):
    id: str
    relationship_type: str
    effective_date: date
    reason: str | None
    predecessor_fdr_id: str
    successor_fdr_id: str
    predecessor_masked: str
    successor_masked: str


class FdrDetailOut(BaseModel):
    id: str
    institution: InstitutionOut
    issuer_bank: str
    branch: str | None
    ifsc: str | None
    fdr_number_masked: str
    principal_amount: str
    currency: str
    interest_rate: str | None
    issue_date: date
    maturity_date: date
    days_remaining: int
    lien_beneficiary: str | None
    status: StatusBlock
    assigned_officer_id: str | None
    version: int
    attention_level: str
    created_at: datetime
    updated_at: datetime
    evidence_fields: list[ExtractedFieldOut]
    documents: list[DocumentOut]
    verification_checks: list[VerificationCheckOut]
    findings: list[FindingOut]
    review_decisions: list[ReviewDecisionOut]
    links: list[LinkOut]
    release_request_id: str | None
    permitted_actions: list[str]


# --- uploads ------------------------------------------------------------------


class UploadSessionIn(BaseModel):
    fdr_id: str
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="application/pdf")
    size_bytes: int = Field(gt=0)
    document_type: str = Field(default="FDR_CERTIFICATE", max_length=48)


class UploadSessionOut(BaseModel):
    upload_session_id: str
    upload_url: str
    method: str
    max_size_bytes: int
    accepted_content_types: list[str]
    expires_at: datetime
    notes: str


class UploadFinalizeOut(BaseModel):
    document_id: str
    scan_status: str
    scan_detail: str
    processing_status: str
    extraction_status: str | None
    evidence_fields: list[ExtractedFieldOut]
    document_processing_status: str


class SubmitIn(BaseModel):
    attestation: bool
    corrections: dict[str, str] = Field(default_factory=dict)
    correction_reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _attested(self) -> "SubmitIn":
        if not self.attestation:
            raise ValueError("The institution must attest to the submitted values")
        if self.corrections and not self.correction_reason:
            raise ValueError("A correction requires a reason")
        return self


class ScrutinyIn(BaseModel):
    decision: str = Field(pattern="^(START_REVIEW|REQUEST_CLARIFICATION|ACCEPT|REJECT|OBSERVE)$")
    reason: str = Field(min_length=5, max_length=2000)
    expected_version: int | None = None


class MockBankIn(BaseModel):
    scenario_id: str | None = None
    checks: list[str] = Field(default_factory=lambda: ["NUMBER", "AMOUNT", "MATURITY_DATE", "LIEN_STATUS"])


class ReplacementIn(BaseModel):
    successor: FdrDraftIn
    relationship_type: str = Field(default="REPLACEMENT", pattern="^(REPLACEMENT|RENEWAL)$")
    effective_date: date
    reason: str = Field(min_length=5, max_length=1000)


class FindingDispositionIn(BaseModel):
    status: str = Field(pattern="^(ACKNOWLEDGED|RESOLVED|FALSE_POSITIVE|OPEN)$")
    reason: str = Field(min_length=5, max_length=1000)


# --- releases -----------------------------------------------------------------


class ReleaseRequestIn(BaseModel):
    fdr_id: str
    basis_code: str
    justification: str = Field(min_length=10, max_length=2000)
    document_ids: list[str] = Field(default_factory=list)


class ClearanceOut(BaseModel):
    id: str
    bureau_code: str
    bureau_name: str
    required: bool
    state: str
    requirement_version: str
    outcome: str | None
    reason: str | None
    decided_by: str | None
    decided_at: datetime | None
    valid_until: date | None


class ApprovalOut(BaseModel):
    id: str
    stage: str
    outcome: str
    reason: str
    actor_label: str
    decided_at: datetime


class ReleaseChecklistItem(BaseModel):
    code: str
    label: str
    satisfied: bool
    document_id: str | None


class ReleaseRequestOut(BaseModel):
    id: str
    fdr_id: str
    fdr_number_masked: str
    institution_id: str
    institution_name: str
    basis_code: str
    basis_label: str
    justification: str
    status: str
    hold_reason: str | None
    policy_version: str
    version: int
    requested_by_label: str
    prepared_by: str | None
    approved_by: str | None
    created_at: datetime
    decided_at: datetime | None
    clearances: list[ClearanceOut]
    checklist: list[ReleaseChecklistItem]
    approvals: list[ApprovalOut]
    blocking_reasons: list[str]
    can_finally_approve: bool
    principal_amount: str
    maturity_date: date


class ClearanceDecisionIn(BaseModel):
    outcome: str = Field(pattern="^(CLEARED|OBJECTION|CLARIFICATION_REQUIRED)$")
    reason: str = Field(min_length=5, max_length=2000)
    valid_until: date | None = None


class ReleaseActionIn(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)
    expected_version: int


# --- dashboards ---------------------------------------------------------------


class KpiOut(BaseModel):
    key: str
    label: str
    value: str
    unit: str
    inclusion_criteria: str
    filter_hint: dict[str, str] = Field(default_factory=dict)


class MaturityBucketOut(BaseModel):
    label: str
    month: str | None = None
    count: int
    amount: str


class OverviewOut(BaseModel):
    scope_label: str
    as_of: datetime
    kpis: list[KpiOut]
    maturity_by_month: list[MaturityBucketOut]
    verification_backlog: list[MaturityBucketOut]
    action_needed: list[FdrListItem]
    recent_activity: list[AuditEventOut]


class MaturityItemOut(BaseModel):
    fdr: FdrListItem
    band: str
    next_action: str
    reminders_sent: int
    predecessor_id: str | None
    successor_id: str | None


class NotificationOut(BaseModel):
    id: str
    event_type: str
    category: str
    title: str
    body: str
    due_date: date | None
    fdr_id: str | None
    release_request_id: str | None
    status: str
    read_at: datetime | None
    acknowledged_at: datetime | None
    created_at: datetime


class ReportRowOut(BaseModel):
    columns: list[str]
    rows: list[list[str]]
    report_run_id: str
    scope_label: str
    generated_at: datetime
    watermark: str
