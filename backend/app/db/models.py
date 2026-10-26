"""Domain tables.

The schema keeps the status dimensions of the backend brief separate: a
submission state never doubles as a bank result, and a bank result never
doubles as an officer decision.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin


class Institution(Base, IdMixin, TimestampMixin):
    __tablename__ = "institutions"

    aicte_id: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    legal_holder_name: Mapped[str | None] = mapped_column(String(200), default=None)
    region_code: Mapped[str] = mapped_column(String(32), default="SOUTH")
    state: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(24), default="ACTIVE")

    fdrs: Mapped[list["Fdr"]] = relationship(back_populates="institution")


class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(190), unique=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_enrolled: Mapped[bool] = mapped_column(Boolean, default=False)

    role_assignments: Mapped[list["RoleAssignment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RoleAssignment(Base, IdMixin, TimestampMixin):
    """A role is only meaningful together with the scope it was granted for."""

    __tablename__ = "role_assignments"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(48))
    scope_type: Mapped[str] = mapped_column(String(24))  # INSTITUTION | REGION | GLOBAL
    scope_id: Mapped[str | None] = mapped_column(String(64), default=None)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship(back_populates="role_assignments")


class PolicyVersion(Base, IdMixin, TimestampMixin):
    __tablename__ = "policy_versions"

    ruleset_name: Mapped[str] = mapped_column(String(64))
    version: Mapped[str] = mapped_column(String(32))
    sha256: Mapped[str] = mapped_column(String(64))
    effective_from: Mapped[date] = mapped_column(Date)
    published_by: Mapped[str | None] = mapped_column(String(120), default=None)

    __table_args__ = (UniqueConstraint("ruleset_name", "version", name="uq_policy_version"),)


class Fdr(Base, IdMixin, TimestampMixin):
    __tablename__ = "fdrs"
    __table_args__ = (
        CheckConstraint("principal_amount > 0", name="ck_fdr_positive_principal"),
        CheckConstraint("maturity_date >= issue_date", name="ck_fdr_valid_dates"),
    )

    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    issuer_bank: Mapped[str] = mapped_column(String(120))
    branch: Mapped[str | None] = mapped_column(String(120), default=None)
    ifsc: Mapped[str | None] = mapped_column(String(16), default=None)
    fdr_number_masked: Mapped[str] = mapped_column(String(80))
    fdr_number_ciphertext: Mapped[str] = mapped_column(Text)
    fdr_lookup_hash: Mapped[str] = mapped_column(String(64), index=True)
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), default=None)
    issue_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date] = mapped_column(Date, index=True)
    lien_beneficiary: Mapped[str | None] = mapped_column(String(180), default=None)

    submission_status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    document_processing_status: Mapped[str] = mapped_column(String(32), default="NOT_UPLOADED")
    bank_verification_status: Mapped[str] = mapped_column(String(32), default="NOT_REQUESTED")
    review_status: Mapped[str] = mapped_column(String(32), default="NOT_SUBMITTED")
    instrument_status: Mapped[str] = mapped_column(String(32), default="REGISTERED")
    lien_status: Mapped[str] = mapped_column(String(24), default="UNKNOWN")

    assigned_officer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)

    institution: Mapped[Institution] = relationship(back_populates="fdrs")
    documents: Mapped[list["FdrDocument"]] = relationship(back_populates="fdr")
    checks: Mapped[list["VerificationCheck"]] = relationship(back_populates="fdr")
    findings: Mapped[list["Finding"]] = relationship(back_populates="fdr")


class FdrSubmission(Base, IdMixin, TimestampMixin):
    """Immutable snapshot of what the institution attested to, and when."""

    __tablename__ = "fdr_submissions"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    submitted_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    claims_json: Mapped[str] = mapped_column(Text)
    attestation_version: Mapped[str] = mapped_column(String(24), default="ATTEST-1.0")
    submission_status: Mapped[str] = mapped_column(String(32), default="SUBMITTED")


class UploadSession(Base, IdMixin, TimestampMixin):
    __tablename__ = "upload_sessions"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    object_key: Mapped[str] = mapped_column(String(255))
    declared_content_type: Mapped[str] = mapped_column(String(120))
    declared_size_bytes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="PENDING_UPLOAD")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    document_id: Mapped[str | None] = mapped_column(String(36), default=None)


class FdrDocument(Base, IdMixin, TimestampMixin):
    __tablename__ = "fdr_documents"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    upload_session_id: Mapped[str | None] = mapped_column(String(36), default=None)
    document_type: Mapped[str] = mapped_column(String(48), default="FDR_CERTIFICATE")
    object_key: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer)
    scan_status: Mapped[str] = mapped_column(String(32), default="QUARANTINED")
    scan_detail: Mapped[str | None] = mapped_column(Text, default=None)
    processing_status: Mapped[str] = mapped_column(String(32), default="QUEUED")
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))

    fdr: Mapped[Fdr] = relationship(back_populates="documents")
    extractions: Mapped[list["FdrExtraction"]] = relationship(back_populates="document")


class FdrExtraction(Base, IdMixin, TimestampMixin):
    """Parser evidence. Never an authoritative financial decision."""

    __tablename__ = "fdr_extractions"

    document_id: Mapped[str] = mapped_column(ForeignKey("fdr_documents.id"), index=True)
    engine: Mapped[str] = mapped_column(String(48))
    engine_version: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="READY")
    extracted_json: Mapped[str] = mapped_column(Text)
    confidence_json: Mapped[str] = mapped_column(Text)
    bbox_json: Mapped[str] = mapped_column(Text)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    document: Mapped[FdrDocument] = relationship(back_populates="extractions")


class VerificationCheck(Base, IdMixin, TimestampMixin):
    __tablename__ = "verification_checks"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    check_type: Mapped[str] = mapped_column(String(48))
    source_kind: Mapped[str] = mapped_column(String(32))  # DOCUMENT|RULES|MOCK_BANK|AUTHORIZED_BANK
    scenario_id: Mapped[str | None] = mapped_column(String(64), default=None)
    result: Mapped[str] = mapped_column(String(48))
    detail_json: Mapped[str] = mapped_column(Text, default="{}")
    source_ref: Mapped[str | None] = mapped_column(String(120), default=None)
    response_hash: Mapped[str | None] = mapped_column(String(80), default=None)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    performed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    fdr: Mapped[Fdr] = relationship(back_populates="checks")


class ReviewDecision(Base, IdMixin, TimestampMixin):
    __tablename__ = "review_decisions"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    policy_version_id: Mapped[str | None] = mapped_column(String(36), default=None)


class FdrLink(Base, IdMixin, TimestampMixin):
    __tablename__ = "fdr_links"
    __table_args__ = (
        CheckConstraint("predecessor_fdr_id <> successor_fdr_id", name="ck_link_distinct"),
    )

    predecessor_fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    successor_fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    relationship_type: Mapped[str] = mapped_column(String(32), default="REPLACEMENT")
    effective_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(Text, default=None)
    recorded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class Finding(Base, IdMixin, TimestampMixin):
    """A deterministic rule finding, with its evidence. Not a fraud verdict."""

    __tablename__ = "findings"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    release_request_id: Mapped[str | None] = mapped_column(String(36), default=None)
    rule_id: Mapped[str] = mapped_column(String(48), index=True)
    rule_version: Mapped[str] = mapped_column(String(24))
    category: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(200))
    explanation: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str] = mapped_column(Text)
    evidence_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(24), default="OPEN")
    disposition_reason: Mapped[str | None] = mapped_column(Text, default=None)
    disposed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    fdr: Mapped[Fdr] = relationship(back_populates="findings")

    __table_args__ = (UniqueConstraint("fdr_id", "rule_id", name="uq_finding_open_rule"),)


class ReleaseRequest(Base, IdMixin, TimestampMixin):
    __tablename__ = "release_requests"

    fdr_id: Mapped[str] = mapped_column(ForeignKey("fdrs.id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    basis_code: Mapped[str] = mapped_column(String(48))
    justification: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="REQUESTED", index=True)
    hold_reason: Mapped[str | None] = mapped_column(Text, default=None)
    policy_version_id: Mapped[str | None] = mapped_column(String(36), default=None)
    prepared_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)

    clearances: Mapped[list["ClearanceRequirement"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class ReleaseDocument(Base, IdMixin, TimestampMixin):
    __tablename__ = "release_documents"

    request_id: Mapped[str] = mapped_column(ForeignKey("release_requests.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("fdr_documents.id"))
    document_type: Mapped[str] = mapped_column(String(48))
    checklist_version: Mapped[str] = mapped_column(String(24))


class ClearanceRequirement(Base, IdMixin, TimestampMixin):
    __tablename__ = "clearance_requirements"

    request_id: Mapped[str] = mapped_column(ForeignKey("release_requests.id"), index=True)
    bureau_code: Mapped[str] = mapped_column(String(32))
    bureau_name: Mapped[str] = mapped_column(String(120))
    requirement_version: Mapped[str] = mapped_column(String(24))
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    state: Mapped[str] = mapped_column(String(32), default="PENDING")

    request: Mapped[ReleaseRequest] = relationship(back_populates="clearances")
    decisions: Mapped[list["ClearanceDecision"]] = relationship(back_populates="requirement")


class ClearanceDecision(Base, IdMixin, TimestampMixin):
    __tablename__ = "clearance_decisions"

    requirement_id: Mapped[str] = mapped_column(
        ForeignKey("clearance_requirements.id"), index=True
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    outcome: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    valid_until: Mapped[date | None] = mapped_column(Date, default=None)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    requirement: Mapped[ClearanceRequirement] = relationship(back_populates="decisions")


class ApprovalDecision(Base, IdMixin, TimestampMixin):
    __tablename__ = "approval_decisions"

    request_id: Mapped[str] = mapped_column(ForeignKey("release_requests.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    stage: Mapped[str] = mapped_column(String(24))  # PREPARE | REVIEW | FINAL
    outcome: Mapped[str] = mapped_column(String(24))
    reason: Mapped[str] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NotificationEvent(Base, IdMixin, TimestampMixin):
    __tablename__ = "notification_events"

    fdr_id: Mapped[str | None] = mapped_column(ForeignKey("fdrs.id"), default=None, index=True)
    release_request_id: Mapped[str | None] = mapped_column(String(36), default=None)
    event_type: Mapped[str] = mapped_column(String(48))
    category: Mapped[str] = mapped_column(String(24), default="DEADLINE")
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date, default=None)
    recipient_scope: Mapped[str] = mapped_column(String(64))
    recipient_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    dedupe_key: Mapped[str] = mapped_column(String(190), unique=True)
    status: Mapped[str] = mapped_column(String(24), default="QUEUED")
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class OutboxEvent(Base, IdMixin, TimestampMixin):
    """Transactional outbox: side effects are dispatched after the commit."""

    __tablename__ = "outbox_events"

    event_type: Mapped[str] = mapped_column(String(64))
    aggregate_type: Mapped[str] = mapped_column(String(48))
    aggregate_id: Mapped[str] = mapped_column(String(36), index=True)
    payload_redacted: Mapped[str] = mapped_column(Text, default="{}")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)


class AuditEvent(Base, IdMixin):
    """Append-only. The application role must not hold UPDATE or DELETE here."""

    __tablename__ = "audit_events"

    aggregate_type: Mapped[str] = mapped_column(String(48), index=True)
    aggregate_id: Mapped[str] = mapped_column(String(36), index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), default=None)
    actor_label: Mapped[str] = mapped_column(String(160), default="system")
    action: Mapped[str] = mapped_column(String(64), index=True)
    outcome: Mapped[str] = mapped_column(String(24), default="ALLOW")
    old_state_summary: Mapped[str | None] = mapped_column(Text, default=None)
    new_state_summary: Mapped[str | None] = mapped_column(Text, default=None)
    reason: Mapped[str | None] = mapped_column(Text, default=None)
    request_id: Mapped[str | None] = mapped_column(String(64), default=None)
    integrity_digest: Mapped[str] = mapped_column(String(64), default="")
    previous_digest: Mapped[str | None] = mapped_column(String(64), default=None)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class CommandReceipt(Base, IdMixin, TimestampMixin):
    """Idempotency receipts for sensitive writes."""

    __tablename__ = "command_receipts"
    __table_args__ = (
        UniqueConstraint("actor_id", "idempotency_key", name="uq_receipt_actor_key"),
    )

    actor_id: Mapped[str] = mapped_column(String(36))
    idempotency_key: Mapped[str] = mapped_column(String(120))
    command: Mapped[str] = mapped_column(String(64))
    response_json: Mapped[str] = mapped_column(Text)


class ObjectBlob(Base, IdMixin, TimestampMixin):
    """Document bytes, when the database-backed object store is in use.

    A serverless deployment has no durable filesystem, so the private
    quarantine/clean namespaces live in this table instead. The trade-off is
    the database inflation the architecture brief warns about; it is bounded
    here by the upload size limit and the prototype's scale, and an S3-backed
    adapter remains the deployment path.
    """

    __tablename__ = "object_blobs"

    object_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    content_type: Mapped[str] = mapped_column(String(120), default="application/pdf")
    size_bytes: Mapped[int] = mapped_column(Integer)
    payload: Mapped[bytes] = mapped_column(LargeBinary)
