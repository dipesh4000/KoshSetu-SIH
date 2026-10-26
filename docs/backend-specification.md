# KoshSetu

# AICTE Security Deposit / FDR Management Portal — Backend Architecture, Security & API Specification | SIH26265

Smart India Hackathon 2026 • Implementation Brief

26 October 2026 | Version 3.0 — Brand Identity Edition

ENGINEERING SPECIFICATION • SMART INDIA HACKATHON 2026

Government-grade security posture • Controlled financial workflows • Explicitly simulated bank verification

Status: Implementation-ready design brief (prototype; subject to AICTE and policy-owner validation)
Prepared: 26 October 2026
Companion document: Frontend Product & UI/UX Specification
Project brand: KoshSetu — Secure deposits. Traceable decisions. Independent SIH prototype; not an official AICTE or bank platform.


# 01. Problem statement and engineering scope

Problem statement ID: SIH26265
Official title: Streamline of security deposit/ FDR portal.
Issuer: All India Council for Technical Education (AICTE), Regulation Bureau
Category / theme: Software / Smart Automation.

Problem statement — engineering summary (not a verbatim reproduction). AICTE seeks a secure centralized portal for institution-wise and instrument-wise security deposits and Fixed Deposit Receipts (FDRs). It should collect instrument identifiers, bank information, amounts, dates, status, document evidence and approved administrative changes; verify submitted details through authorized sources wherever supported; detect discrepancies; monitor maturity and renewal/replacement actions; process controlled release/refund requests; provide reminders, dashboards, reports, audit histories, role-based access and appropriate secure integrations. The prototype must demonstrate an end-to-end lifecycle and measurable operational improvements with realistic test scenarios.

Bank-verification constraint — mandatory: Authenticity and lien confirmation require authorized bank-issued evidence or official integrations. No such production bank API is assumed available. This project will use a separate mock bank verification adapter providing synthetic signed responses to model integration behavior. This can validate workflow correctness but cannot establish any FDR’s real-world authenticity. The API, database and UI must preserve MOCK_BANK provenance, and never call a mock result “independently verified.” A successful simulated bank check must never automatically bypass officer review or trigger fund release.

Design priority: security and regulatory traceability first; correctness and reliable recovery second; maintainable delivery third; latency and cost optimization after controls are validated. Financial information is sensitive, but prototype data must be synthetic and non-real. Production readiness requires owner-driven legal/regulatory review, authorized hosting, a formal threat model, audits and external integration agreements.

Sources consulted: SIH official list https://www.sih.gov.in/sih2026PS (blocked from automatic retrieval); accessible SIH26265 reproduction https://zaidsayyed.in/tools/sih-problem-statements/sih26265 ; GIGW 3.0 https://guidelines.india.gov.in/ ; OWASP ASVS 5.0 https://asvs.owasp.org/ ; AICTE APH PDF https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf. Read all applicable official materials before any government pilot; this is an architectural proposal, not a certification or legal opinion.


# 02. Executive architecture decisions


| Decision | Selected approach | Why / rejected alternative |
| --- | --- | --- |
| Application architecture | Modular monolith with well-isolated domains | Avoid premature microservices, extra network trust boundaries and operational overhead |
| Backend runtime | FastAPI, Python 3.12+, strict Pydantic v2 | Mature validation, typed contracts, documentation; async used only for I/O |
| Data store | PostgreSQL + SQLAlchemy 2.x + Alembic | Transactions, row locks, constraints, versioned migrations |
| Background jobs | Celery + Redis broker, or equivalent reviewed queue | OCR, notifications, mock calls; durable job records reside in PostgreSQL |
| Documents | Private S3-compatible object storage | Avoid database BLOB inflation; versioning, lifecycle and restricted download |
| Document parsing | PyMuPDF first, OCR on scanned pages via Tesseract/DocTR | Reduce CPU and extraction errors on text-native PDFs |
| Bank interface | Mock verifier behind replaceable adapter | Honest SIH simulation, testable response contracts |
| Reminders | PostgreSQL schedule + notification outbox | Correctness and idempotency; Redis is not expiry source of truth |
| Authentication | OIDC/central IdP-ready design; secure sessions, MFA for officials | Prefer reviewed IdP, short-lived credentials and least privilege |
| Authorization | RBAC + resource/attribute-based checks | Role alone cannot protect institution/region/case scope |
| Audit | Append-only events with correlation and tamper-evidence plan | Compliance evidence must survive failed jobs and human disputes |
| External state changes | Explicit policy-gated state machine | Prevent invalid release, undocumented overrides, double decisions |
| Observability | Structured logs, metrics, traces and alerts, with PII redaction | Security investigations without leaking financial content |


Non-goals: actual bank authentication; moving money; real government data ingestion; automatically approving an FDR based on OCR; building a custom fraud ML model; an LLM in decision-critical flows; Kafka/Kubernetes/service mesh without operational need; representing simulated controls as a certified government production deployment.


# 03. System boundaries, deployment and trust model


## 3.1 Logical components

```text
Untrusted Browser (institution / official)
   │ HTTPS + authenticated session + CSRF protection
   ▼
Edge (WAF / rate limits / TLS / security headers)
   │
   ▼
FastAPI modular monolith ─────────────► PostgreSQL (source of truth)
   │       │                                  │
   │       ├─ Access-control policy          ├─ FDR + institution records
   │       ├─ Case/state machine             ├─ verification evidence
   │       ├─ Release/clearance engine       ├─ audit/outbox/job statuses
   │       └─ Signed upload/download         └─ rule versions
   │
   ├──► Private object storage (quarantine / clean / retained)
   │
   └──► Queue broker ► Worker(s)
                       ├─ malware/format scanning
                       ├─ native PDF extraction / OCR
                       ├─ rules & discrepancy checks
                       ├─ simulated bank adapter (DEMO ONLY)
                       └─ reminders/email; write results to PostgreSQL
```

Admin / auditor / clearance officers use the same protected API with tighter
resource policies; no direct database or storage access from browsers.

Control/data plane separation: applications only receive access to records justified by current identity, role, institution assignment and action. Mock bank components run with separate credentials and no database superuser grants. Object-storage buckets remain private, deny public ACLs and are accessible via narrowly scoped service identities.


## 3.2 Architecture boundaries

Identity boundary: user ↔ identity provider; JWT claims must be validated for issuer, audience, signature, expiry and token purpose. Prefer backend-secure session/token exchange where practical.

Tenant boundary: institutions may access only their records; assigned officials may access only their approved region/bureau/cases. Never trust institution_id from a browser request if it conflicts with authenticated binding.

Document boundary: an uploaded object is untrusted until scanned/validated. Quarantined files never become visible to the PDF viewer.

Bank boundary: mock verifier is synthetic and never considered bank-issued evidence; future real connector must enforce legal authorization, channel security and response validation.

Workflow boundary: administrative approval is distinct from bank response, physical deposit maturity and actual redemption/discharge; the portal records each separately.

Notification boundary: external email is untrusted and should not contain full FDR number, document download URL, principal details beyond approved policy or secrets.


## 3.3 Environment plan

Local SIH: Docker Compose: API, worker, beat scheduler, PostgreSQL, Redis, MinIO/S3-compatible store, mock bank adapter and seeded test data. Staging: separate deployment and secrets, full synthetic datasets, restricted tester accounts. Production proposal: government-approved hosting, private networking, managed KMS, WAF, separate workers, backup/DR, central logging, approved email relay and independent security review. Production data must never be copied into public demos.

Environment controls: disable mock end-to-end banking outcomes in any real production environment by a deployment gate, signed configuration and separate adapter credentials. BANK_PROVIDER=mock must be visibly tagged in every response and blocked from labeling real FDRs as authentically bank-confirmed. Keep debug docs and interactive Swagger hidden or restricted outside development.


# 04. Domain model and identity of a financial instrument


## 4.1 Core concepts

Institution: AICTE-recognized institution entity; distinct from trust/society/legal holder where applicable.

FDR instrument: one deposit instrument with issuer bank, identification, principal, issue/maturity dates and lien metadata; may be succeeded or superseded but not silently rewritten.

Submission: institution’s declared metadata and attestation at a point in time, tied to a document version.

Document: immutable uploaded object version, checksum, security scan result and parsing provenance.

Verification check: a bounded evidence check (format/rules/document fields/mock bank/authorized bank), with outcome, source, time and reference.

Regulatory review: officer’s administrative decision and observations; not the same as the bank verification result.

Renewal or replacement: a relationship from predecessor to successor instrument, subject to applicable rules; keep history.

Release request: case requiring supporting evidence, clearances and competent final authorization; no direct disbursement.

Audit event: security- and business-relevant action, actor, case, reason, record version and time.


## 4.2 Separate status dimensions

Do not use the original all-purpose enum PENDING_VERIFICATION / ACTIVE / DISCREPANCY / MATURING / RENEWAL_REQUESTED / RELEASED. These values overlap. Define independent state machines:


| Dimension | Illustrative values | Controlled by |
| --- | --- | --- |
| submission_status | DRAFT, UPLOADED, SUBMITTED, CORRECTION_REQUESTED, WITHDRAWN | Institution + scrutiny |
| document_processing_status | QUARANTINED, CLEAN, EXTRACTING, READY, FAILED | Security/parser workers |
| bank_verification_status | NOT_REQUESTED, PENDING, MOCK_MATCH, MOCK_MISMATCH, MOCK_ERROR, AUTHENTICATED_EXTERNAL, EXTERNAL_UNAVAILABLE | Bank adapter with evidence policy |
| review_status | QUEUED, IN_REVIEW, CLARIFICATION_REQUIRED, ACCEPTED, REJECTED | Authorized officials |
| instrument_status | REGISTERED, ACTIVE, SUPERSEDED, MATURED, RELEASE_RECORDED, ARCHIVED | State-machine/policy |
| lien_status | UNKNOWN, CLAIMED, CONFIRMED, DISPUTED, RELEASED | Bank source/authorized record |
| release_status | NOT_REQUESTED, REQUESTED, DOCUMENTS_PENDING, CLEARANCES_PENDING, ON_HOLD, READY_FOR_DECISION, APPROVED, REJECTED, CLOSED | Clearance/maker-checker workflow |


Maturing is a derived condition, e.g., maturity_date BETWEEN today AND today + 30 days, not the sole lifecycle state. Matured does not prove money was released. AUTHENTICATED_EXTERNAL must be unreachable through the mock adapter; all provenance assertions must be enforced server-side, not by UI strings.


## 4.3 Deterministic transition rules

Submit draft: requires clean scanned document, validated identity, amount > 0, plausible issue/maturity dates and attestation. Start review: requires submitted state and authorized assignment. Accept review: requires required checks and officer decision; production policies may require independently confirmed bank evidence. In the demo, record “Accepted for demo administrative workflow with mock evidence”, not a real-world approval. Link replacement: creates successor FDR and stores prior link; never overwrites original issue date, amount or documents. Approve release: requires prescribed evidence, all required clearances, no active hold, maker/checker separation and final authority.

All transitions follow the sequence: authorize → load current version with lock → check prerequisites/rules → apply state change → insert audit and outbox rows → commit → dispatch notifications asynchronously. State mutation without audit insertion must fail as one transaction.


# 05. Database design: normalized schema and constraints

UUIDs for primary keys; TIMESTAMPTZ for events; SQL DATE for instrument issue/maturity; NUMERIC(18,2) for INR amounts (no binary float); JSONB only for appropriately bounded evidence payloads; created_at, updated_at, version where applicable. Use explicit foreign keys, NOT NULL, checks and measured indexes. Do not rely on indexing fdr_number alone without issuer/institution scope.


## 5.1 Identity and access tables


| Table | Key fields | Notes / constraints |
| --- | --- | --- |
| institutions | id, aicte_id, legal_holder_id, name, region_id, status | aicte_id UNIQUE; active/suspended metadata |
| legal_holders | id, entity_type, name, verified_identity_ref | Separate holder from institution if applicable |
| users | id, idp_subject, email, display_name, active, mfa_enrolled | idp_subject UNIQUE; no raw passwords if IdP |
| role_assignments | id, user_id, role, scope_type, scope_id, active_from/to | Scoped roles; unique active grants policy |
| case_assignments | id, fdr_id, user_id, function, assigned_by | Workflow-specific assignment |
| policy_versions | id, ruleset_name, version, effective_from/to, published_by, sha256 | Preserve policy used in historical decisions |



## 5.2 Instrument and evidence tables


| Table | Key fields | Notes / constraints |
| --- | --- | --- |
| fdrs | id, institution_id, legal_holder_id, issuer_bank_id, fdr_number_masked, fdr_number_ciphertext, fdr_lookup_hash, principal_amount, currency, issue_date, maturity_date, lien_beneficiary, lien_status, instrument_status, version | principal_amount > 0, maturity_date >= issue_date; protect full identifier, avoid irreversible exact-unique assumptions |
| fdr_submissions | id, fdr_id, submitted_by, submitted_at, version, claims_json, attestation_version, submission_status | Immutable submitted snapshot after attestation |
| fdr_documents | id, fdr_id, submission_id, object_key, sha256, content_type, size_bytes, scan_status, version, uploaded_by, uploaded_at | Private object key; duplicate detection by hash is a hint, not proof |
| fdr_extractions | id, document_id, engine, model_version, extracted_json, confidence_json, bbox_json, status, finished_at | Evidence provenance; no authoritative financial decision |
| verification_checks | id, fdr_id, check_type, source_kind, scenario_id, result, source_ref, response_hash, performed_at, expires_at | source_kind explicitly DOCUMENT, RULES, MOCK_BANK or AUTHORIZED_BANK |
| review_decisions | id, fdr_id, actor_id, decision, reason, evidence_snapshot_id, policy_version_id, created_at | Immutable decision events, superseding correction event |
| fdr_links | id, predecessor_fdr_id, successor_fdr_id, relationship_type, effective_date, recorded_by | Avoid cycles; check predecessor != successor |


Sensitive identifier strategy: store a deterministic keyed lookup token (HMAC-SHA256 over canonical issuer+identifier) for search/duplicate candidates, ciphertext for authorized reveal and last four/masked display. Keep HMAC/encryption keys in approved secret management. Do not place raw FDR numbers in audit messages. A bank+number pair may not be globally unique if formats collide, so run a duplicate-candidate review rather than blindly applying an invalid global unique constraint.


## 5.3 Release, communication and audit tables


| Table | Key fields | Notes / constraints |
| --- | --- | --- |
| release_requests | id, fdr_id, requested_by, basis_code, status, policy_version_id, created_at, version | One active request constraint as appropriate |
| release_documents | request_id, document_id, document_type, checklist_version | Prescribed evidence references |
| clearance_requirements | id, request_id, bureau_code, requirement_version, required, state | Generated from applicable policy at case start |
| clearance_decisions | id, requirement_id, actor_id, outcome, reason, evidence_doc_id, decided_at | Immutable individual bureau decision |
| approval_decisions | id, request_id, actor_id, stage, outcome, decided_at, attestation_ref | Maker/checker/final authority separated |
| notification_events | id, fdr_id, event_type, due_date, recipient_scope, dedupe_key, status | Unique dedupe key; retryable lifecycle |
| delivery_attempts | id, event_id, channel, provider_message_id, attempt, result, sent_at | Delivery audit and retry |
| outbox_events | id, event_type, aggregate_id, payload_redacted, available_at, dispatched_at, attempt_count | Transactional outbox |
| audit_events | id, aggregate_type, aggregate_id, actor_id, action, old_state_summary, new_state_summary, reason, request_id, occurred_at, integrity_digest | Append-only; controlled reads and retention |
| jobs | id, kind, aggregate_id, attempt, status, queued_at, started_at, finished_at, failure_code | Track eventual work independently of broker |



## 5.4 Indexing, transactions and integrity

Suggested first-pass indexes: (institution_id, maturity_date), (instrument_status, maturity_date), (review_status, assigned_officer_id) if denormalized or via assignment table, (release_requests.status, created_at), (notification_events.status, due_date) and (audit_events.aggregate_id, occurred_at DESC). Add partial indexes only after real query review. Use keyset pagination for large append-only histories and cursor pagination for FDR lists if stable sort is available. GIN indexes on JSONB only if actual filtered attributes require them; dedicated normalized columns are better for frequent finance filters.

Transaction example: final release approval must lock the request row (SELECT ... FOR UPDATE), recheck active clearance rows and maker/checker conditions, increment version, append approval and audit records, insert outbox event and commit. Do not send email inside the database transaction. Isolation defaults can be READ COMMITTED with explicit locks; strengthen where anomaly testing proves necessary. Guard repeats using a client idempotency key and unique command receipt.


## 5.5 Migration, retention and data classification

Alembic migrations are reviewed, version-controlled and forward-compatible; never edit the database ad hoc during demos. Seed synthetic institutions, users and cases deterministically. Retention periods, record disposal, document legal hold and public-record obligations are not guessed here—they must be approved by the institution/government owner according to applicable law and record-retention rules. Minimize sensitive data and use separate retention classes for operational logs, audit decisions, OCR intermediates and original evidence.


# 06. Secure upload, storage, document processing and OCR


## 6.1 Trust-preserving upload protocol

Authenticated submitter calls POST /v1/upload-sessions with FDR draft, expected file metadata and checksum where available. API checks institution scope, ownership, quotas and allowed content types, then creates PENDING_UPLOAD session with expiry.

API returns a short-lived, single-object presigned upload operation scoped to a generated quarantine key, expected content type/size bounds and no public access. Treat browser-provided MIME type as untrusted.

Browser uploads directly to private object storage. API finalization (POST /v1/upload-sessions/{id}/finalize) or verified S3 → queue event triggers scanning; never treat unverified client notification as proof an object exists.

Worker obtains object metadata, checks checksum/size, magic bytes, PDF structure, password protection and malicious embedded content; runs approved antivirus/document safety checks with resource/time limits. Mark object CLEAN or REJECTED; keep quarantined files unrenderable.

Processing worker first extracts text using PyMuPDF. For image-only pages, run OCR on rasterized pages with page/pixel limits; validate numeric/date strings, normalizations and extraction confidence. Never eval content or execute PDF scripts.

Persist parser evidence with document ID, checksum, page index, bounding boxes, engine version, normalized value and original text. Compare to submitted data through deterministic rules. Institution then attests corrected fields.

Later replacements are new immutable document versions; no destructive overwrite of the original file or its historical check outcome.

Example validations: FDR number normalization handles whitespace/hyphen differences but preserves original; amounts use Decimal; dates check ordering and future plausibility; IFSC syntax is only a format check unless independently confirmed; issuer/lien identity differs from bank authenticity; password-protected/low-quality scans go to manual review. Never substitute OCR confidence for a trust score.


## 6.2 Object storage controls

Private bucket with block-public-access; bucket policy denying anonymous requests; SSE/KMS encryption and TLS; object key namespace separated by environment and institution with random identifiers (not user filename); pre-signed GET restricted to authenticated download authorization and short expiry; no broad ListBucket; server-side malware scan before review; immutable/versioned original record where feasible; lifecycle policies and backup/restore tested. On real deployment require owner approval for storage region/data residency and KMS key management. Encryption at rest is not sufficient without access and export governance.


## 6.3 Abuse and failure scenarios

Malicious 500 MB PDF: reject before processing using enforceable object size, parser page limits and CPU/memory/time quotas; isolate workers.

Duplicate storage event: dedupe using upload-session ID and document checksum; worker operations are idempotent.

Scan worker timeout: transition to SCAN_RETRYABLE_FAILURE with alert; never move to clean implicitly.

OCR low confidence: preserve uncertain extraction with manual review required; do not auto-reject as fraudulent.

Stale presigned URL: explicit 403/re-upload path; cannot reuse someone else’s session/object key.

Wrong institution FDR ID: deny at API before generating upload/read URLs; log access denial safely.

Storage outage: draft retained; queue retries; portal displays pending state and does not promise completion.


# 07. Mock bank integration: realism without false authenticity


## 7.1 Adapter interface

Implement a stable port such as BankVerificationProvider.verify(instrument_ref, institution_context, requested_checks, correlation_id). Provider contracts return: source_kind, provider_id, scenario_id, response_id, checked_at, expires_at, match_results, lien_claim, verification_status, evidence_hash and optional signature_valid. Production connector is disabled/not implemented until authorized agreements and security controls exist.

Critical invariants: a MOCK_BANK source may yield MOCK_MATCH, MOCK_MISMATCH, MOCK_NOT_FOUND, MOCK_TIMEOUT or MOCK_SERVICE_ERROR, never AUTHENTICATED_EXTERNAL. Authenticity claims must be generated only by a separately approved real-bank adapter with cryptographic/channel verification, source attribution and policy acceptance.


## 7.2 Mock request/response example

{
  "request_id": "mock-req-001",
  "instrument_ref": "fdr-demo-uuid",
  "checks": ["NUMBER", "AMOUNT", "MATURITY_DATE", "LIEN_STATUS"]
}

{
  "response_id": "mock-resp-001",
  "source_kind": "MOCK_BANK",
  "scenario_id": "MATCH_WITH_ACTIVE_LIEN",
  "environment": "DEMO",
  "verification_status": "MOCK_MATCH",
  "match_results": {
    "fdr_number": "MATCH",
    "principal_amount": "MATCH",
    "maturity_date": "MATCH"
  },
  "lien_claim": "ACTIVE_SIMULATED",
  "checked_at": "2026-10-26T10:00:00Z",
  "expires_at": "2026-10-27T10:00:00Z",
  "evidence_hash": "sha256:..."
}

Use a dedicated mock service identity and a signed fixture/response envelope (e.g., HMAC or asymmetric signature) to test integrity, timestamp skew, replay rejection and correlation binding. A valid signature from the mock service only authenticates the simulator, not the real bank or instrument. If HMAC is used, rotate its key by environment, store in a secrets manager and never expose it to the frontend. Do not store unverifiable plaintext “bank says OK” flags.


## 7.3 Simulation scenarios and UI alignment

Production Roadmap: Bank Connectivity Pathways: While the prototype enforces strict MOCK_BANK simulation boundaries, a production government deployment bridges to banking infrastructure via: (1) NeSL (National E-Governance Services Ltd) for digital lien recording and verifiable institutional collateral registry under IBC; (2) SFMS (Structured Financial Messaging System) via IDRBT/RBI for secure inter-bank lien advisory messaging; (3) Account Aggregator (AA) framework for consent-based deposit verification; and (4) DigiLocker/NeGD for verified certificate ingestion.


| Scenario ID | Simulated outcome | Expected backend treatment |
| --- | --- | --- |
| MATCH_WITH_ACTIVE_LIEN | All requested fields match | Store MOCK_MATCH evidence; officer review remains separate |
| AMOUNT_MISMATCH | Submitted principal conflicts | Create bank-field discrepancy with simulated source |
| MATURITY_MISMATCH | Dates conflict | Flag rule finding and request scrutiny |
| INSTRUMENT_NOT_FOUND | No simulated record | Store mock not-found; do not pronounce fraud |
| LIEN_MISSING | Mock lien absent | Raise critical action-needed warning |
| PROVIDER_TIMEOUT | No response | Retry/backoff and leave bank status pending/error |
| INVALID_SIGNATURE | Tampered simulator response | Reject response, security audit, no status transition |
| REPLAYED_RESPONSE | Reused ID/timestamp | Reject with replay detection; notify operations |


Mock UX contract: every API response includes is_simulated=true; every bank evidence record holds source kind, fixture version and scenario ID; report exports carry a DEMO watermark/provenance field. Never mix synthetic and real-bank evidence rows without unambiguous type separation.


# 08. FDR integrity engine: rules, explainability and escalation


## 8.1 Purpose and limits

The proposed differentiator is a deterministic Integrity & Action-Needed Engine, not an automated accusation or fraud detector. It prioritizes official work by transparent rule findings with evidence references and versioned configurations. Rules may be statutory/policy-driven, operational or indicative; their authority differs and must be labeled.


## 8.2 Rule catalog (illustrative only)


| Rule ID | Condition | Severity example | Suggested action |
| --- | --- | --- | --- |
| DATA-001 | Institution amount differs from parsed document amount | High | Ask for correction with source evidence |
| DATA-002 | Date unreadable/low-confidence extraction | Medium | Manual document review |
| VERIFY-001 | Required authorized bank check absent or simulation pending | High | Initiate/await permitted verification |
| VERIFY-002 | Bank-source lien claim contradicts submitted lien | Critical | Escalate to responsible official |
| MAT-001 | Maturity in ≤30 days and action unresolved | High | Create reminder and assign follow-up |
| MAT-002 | Maturity passed with unresolved action | Critical | Escalate after applicable grace/policy rules |
| DOC-001 | Required release affidavit missing | High | Request missing document |
| CASE-001 | Release request lacks required clearance | Blocker | Prevent final approval |
| DUP-001 | Possible duplicate issuer+number/token | Medium | Manual duplicate investigation |
| POLICY-001 | Configured case-specific policy requirement not satisfied | Blocker | Resolve prerequisite or escalate |


Every finding stores rule ID/version, detected timestamp, normalized inputs, evidence refs, owner, status (OPEN / ACKNOWLEDGED / RESOLVED / FALSE_POSITIVE) and explanation. A composite queue-priority bucket may rank open cases, but never triggers irreversible action independently. If evidence changes, re-evaluate without deleting prior finding history.


## 8.3 Rule configuration and lifecycle

Version rules by document type, process context, effective date, jurisdiction and authority. Changes require authorized review and publication; history must record which version was applied to past cases. For a hackathon, store a small versioned YAML/JSON rule catalog in source control and capture its hash in the database. Do not build a full visual rule-programming platform before completing the core lifecycle.


# 09. Maturity monitoring, reminders and reliable background jobs


## 9.1 Avoid Redis as authoritative expiry queue

Do not use ZADD as the sole register for deadlines and then ZREM before an email. That loses reminders on partial failure and complicates renewal synchronization. PostgreSQL is authoritative for instrument dates and due notification rules. Redis is only a broker/cache; Celery executes bounded retryable tasks.

Proposed scheduler: Celery Beat periodically evaluates maturity_date, instrument state, pending action and policy thresholds (e.g., 60/30/15/7 days, on/after maturity). In one DB transaction, insert a notification event with a deterministic unique dedupe key such as fdr_id + maturity_date + rule_version + threshold + recipient_scope. Dispatch later via outbox. Use retries/backoff and provider message IDs. The original instrument remains queryable if messaging fails.


## 9.2 Deadline correctness

Calculate maturity-based thresholds using institution/bank business date where prescribed with an explicit timezone; store all event timestamps UTC. Use date-based logic rather than treating every date as an arbitrary Unix millisecond. On replacement/renewal, preserve prior reminders, supersede future ones appropriately and generate new schedule for successor. A task should be safe to run twice and skip events rendered obsolete by a changed instrument version.


## 9.3 Message policy

In-app notices contain title, case ref, due date, owner, reason and action link. Email contains a non-sensitive summary and link to login, never full documents or direct signed object URLs. Critical missed-alert cases trigger operational monitoring. Track pending, attempted, delivered, failed and acknowledged; distinguish notification delivery from human action completion.


## 9.4 Queue and outbox behavior

All work commands have a stable job ID and idempotency key. Use exponential backoff with maximum attempts, dead-letter review and manual replay procedures. Side effects (send message, mock API request, object transform) are performed after transactional persistence. Where broker publish cannot be committed atomically with the DB, the transactional outbox and dispatcher prevent lost side effects. Queue visibility timeout and retry intervals should exceed worst-case job execution expectations; cap runaway OCR and avoid unbounded concurrency.


# 10. Release/refund workflow, controls and audit authority


## 10.1 Business nuance

The portal manages administrative release cases, not direct movement of funds. Relevant AICTE approval-handbook material describes, subject to current applicability, supporting request documents and multiple possible bureau clearances before an NOC/sanction. The prototype must demonstrate a configurable checklist whose final contents are approved by the applicable policy owner. Do not hardcode 2020–21 renewal restrictions as if all future approval years share the same requirements. Distinguish FDR, RTGS and other deposit types when their governing procedures differ.


## 10.2 Release state machine

REQUESTED → DOCUMENT_CHECK → CLEARANCES_PENDING → READY_FOR_DECISION → APPROVED / REJECTED → CLOSED, with ON_HOLD and MORE_INFORMATION_REQUIRED branches. Case-specific clearances are instantiated at request creation from approved policy version; cases do not magically change retroactively when a rule is edited. Each clearance has its own assignee, evidence, outcome and signed/attested administrative decision.


## 10.3 Four-eye rule and blocking checks

AICTE Bureau Clearances & Regional Offices: Multi-tenant scoping maps to AICTE Regional Offices (NRO Kanpur, WRO Mumbai, SRO Chennai, SWRO Bangalore, CRO Bhopal, ERO Kolkata, NWRO Chandigarh). Release requests enforce prerequisite signoffs from: CLEARANCE_APPROVAL_BUREAU (institutional intake compliance), CLEARANCE_FINANCE_BUREAU (no outstanding institutional dues/penalties), and CLEARANCE_LEGAL_CELL (no court injunctions or litigation holds) before the Approving Authority (Checker) can approve.

A request cannot reach approved unless: requester may legitimately request release; instrument linkage is valid; required supporting documents exist and are clean; required clearances are affirmative/current; no configured hold conditions remain; designated checker/final approver has required scope; checker identity differs from maker in restricted flows; version hasn’t changed; all actions generate audit receipts. An authorization change between opening a page and submitting must be caught at commit. Record APPROVED_FOR_RELEASE distinctly from actual bank discharge or paid refund, which require separate external evidence.


## 10.4 Example command pseudocode


The code is a logical contract, not copy-paste-ready implementation. Real functions also validate actor identity, error taxonomy, record state and cryptographic evidence handling.


# 11. Security architecture and threat model


## 11.1 Protected assets and attacker profiles

Sensitive assets: instrument identifiers, principal amounts, scanned financial documents, official decisions, lien information, contact data, bank-simulation signing keys, API credentials, audit records and administrative role assignments. Threat actors: unauthenticated bots, compromised institution accounts, malicious insiders, stolen officer sessions, compromised document uploads, forged mock adapter traffic, risky dependencies and operators with excessive infrastructure privileges.


## 11.2 Threat/control matrix


| Threat | Attack path | Primary preventive/detective controls |
| --- | --- | --- |
| Cross-institution data breach (IDOR/BOLA) | Guess fdr_id or alter institution_id | Record-level authorization on every action; tenant-bound queries and negative tests |
| Privilege escalation | Change role claim/request route | Signed claims + server policy evaluation + admin approval logs + periodic role review |
| Session theft/CSRF | Stolen browser tokens or cross-site POST | HttpOnly Secure cookies, SameSite, CSRF token, short sessions, MFA/step-up |
| Upload exploit / zip bomb PDF | Malicious object processed unsafely | Quarantine, AV, size/page/time limits, isolated worker, safe PDF parsing |
| Mock response forgery/replay | Fake “bank match” payload | Signed service-to-service response, timestamp nonce, correlation ID, replay cache/DB |
| Tampering with release evidence | Replace PDF, overwrite state | Immutable versions, checksums, append-only audit, locked transitions and approvals |
| Duplicate approval/retry | Two concurrent reviewers or double submit | Idempotency key, row lock, version check, unique decision constraints |
| Data theft via logs/exports | PII recorded in telemetry or CSV | Redaction, access-controlled exports, ephemeral links, audited read/export |
| Secrets compromise | Keys committed to Git/config | Secret manager, key rotation, short-lived workload credentials, scanning |
| Denial of service | Slow PDF, huge request, request flood | WAF/rate limit, quotas, worker budget and backpressure |
| Supply chain compromise | Vulnerable PDF/OCR JS/Python package | Lockfiles, SBOM, SCA, update process, protected CI and provenance checks |
| Ransomware / data loss | Storage or DB corruption | Encrypted backups, immutable backup copies as feasible, PITR and restore drills |



## 11.3 Authentication/session controls

Prefer OIDC with an approved identity provider; official users require MFA and step-up for privileged release decisions. If a hackathon local IdP is unavailable, implement demonstrable session controls without claiming real government SSO. Verify issuer/audience/algorithm/expiry and token type; reject alg=none; rotate keys; revoke sessions on disablement. Refresh tokens (if used) are rotating, HttpOnly, Secure and carefully bound to CSRF strategy; do not store them in local storage. Use secure cookie settings, idle/absolute session lifetimes, brute-force protection and safe account recovery.

Authorization: design authorize(actor, action, resource, context) shared across routes and worker-initiated commands. Evaluate role, institution, bureau/region, case assignment, legal scope, workflow state, SoD constraints, privilege expiry and policy version. Deny by default; log privileged denials without sensitive contents. Consider PostgreSQL RLS for defense in depth, but only if connection-pool session context can be set/reset safely; RLS is not a replacement for policy tests.


## 11.4 Transport, data and key controls

HTTPS everywhere with modern TLS configuration, HSTS in approved deployments, secure response headers and restricted CORS origins. Use private subnets/network restrictions between components, short-lived service identities and authenticated service-to-service communication. Encryption at rest on DB, volume, backups and object storage with reviewed KMS/key rotation. For particularly sensitive FDR identifiers, use application-layer encryption plus keyed search hashes rather than pgcrypto alone or unreviewed EncryptedType magic. Keep encryption/decryption privileges separate from broad read roles; follow deployment data-residency decisions of authorized owner.


## 11.5 Audit tamper resistance

A database table marked append-only is not necessarily immutable to a privileged DBA. At minimum: deny app UPDATE/DELETE permissions on audit rows, separate audit writer role, mandatory write-in-transaction, periodic exports/backup, retention policy and monitored privileged access. Stronger deployment: batch digest chaining, signed daily audit checkpoints and WORM/object-lock replicated storage under an independent security principal. Be precise about whether tamper-evidence or full immutability is actually implemented.


## 11.6 Government context and assurance

Use GIGW 3.0 as the government website/app accessibility, UX and cybersecurity context, and OWASP ASVS 5.0 to translate technical controls into testable acceptance checks. GIGW conformity, CERT-In empanelled “safe-to-host” audits, security certificates and production rollout obligations require competent authority and actual assessment. Build an incident response runbook and an assessment of reporting duties under applicable CERT-In directions; legal compliance ownership and incident classifications must be confirmed rather than guessed from a hackathon document.


# 12. API design: core route catalog and contracts

Version root: /api/v1. Use JSON where appropriate, RFC-style HTTP status semantics, X-Request-ID, Idempotency-Key on sensitive writes and If-Match/version for concurrency. Consistent response envelope with data, meta and error. Pagination parameters are validated/capped. The API is not a public unrestricted CRUD interface; mutation routes map to domain commands.


| Method / endpoint | Authorized caller | Main behavior / response |
| --- | --- | --- |
| GET /me | Authenticated | Identity, effective roles, scope, session constraints |
| GET /institutions/me | Institution | Current institution metadata, no arbitrary ID trust |
| GET /fdrs | Scoped roles | Filtered/paginated registry; default restricted scope |
| POST /fdrs/drafts | Institution submitter | Create draft and ID; validate initial claims |
| GET /fdrs/{id} | Scoped roles | Case, versions and permitted evidence summary |
| PATCH /fdrs/{id}/draft | Owning submitter | Versioned draft-only edit, no direct change after submission |
| POST /upload-sessions | Owning submitter | Validate intended upload; signed quarantine URL |
| POST /upload-sessions/{id}/finalize | Session owner | Verify object existence and enqueue scan |
| GET /jobs/{id} | Resource owner / official | Bounded async job status, no sensitive worker internals |
| GET /fdrs/{id}/documents/{docId}/download | Authorized reviewer | Issue scoped short-lived download |
| POST /fdrs/{id}/submit | Institution submitter | Attest and transition; idempotent |
| POST /fdrs/{id}/scrutiny | Assigned officer | Request correction / accept / reject with reason |
| POST /fdrs/{id}/mock-bank-check | Demo-authorized officer | Trigger synthetic verification; provenance enforced |
| GET /fdrs/{id}/verification-checks | Scoped roles | Field outcomes, sources, timestamps and evidence references |
| POST /fdrs/{id}/replacements | Institution + policy | Create/link successor instrument and documents |
| GET /maturities | Scoped roles | Server-derived due windows and unresolved actions |
| GET /exceptions | Scoped roles | Rule findings with evidence and ownership |
| POST /release-requests | Institution authorized | Request release with selected FDR/basis |
| GET /release-requests/{id} | Assigned roles | Checklist, version, approvals and clearances |
| POST /release-requests/{id}/clearances/{code}/decide | Assigned bureau officer | Record clearance with evidence |
| POST /release-requests/{id}/approve | Competent checker/authority | Gate prerequisites, maker-checker, audit atomically |
| GET /audit-events | Scoped auditor/official | Filtered and redacted append-only timeline |
| POST /reports/exports | Scoped roles | Schedule authorized export with audit receipt |
| GET /notifications | Authenticated | Assigned in-app notices, pagination |
| POST /notifications/{id}/ack | Recipient | Idempotent acknowledgement |



## 12.1 Error taxonomy and contract

400 INVALID_INPUT – malformed payload or unsupported state-independent request.

401 AUTHENTICATION_REQUIRED – absent/expired authentication; no details leaked.

403 INSUFFICIENT_SCOPE – role/tenant/jurisdiction or separation-of-duties failure.

404 NOT_FOUND – can deliberately conceal unauthorized existence where policy requires.

409 STATE_CONFLICT – invalid transition, stale revision or duplicate command conflict.

413 FILE_TOO_LARGE – hard upload limit.

415 UNSUPPORTED_FILE_TYPE – non-approved media/document structure.

422 VALIDATION_FAILED – field-level semantic validation; JSON details bounded.

429 RATE_LIMITED – user/IP/resource quotas; Retry-After supplied when meaningful.

503 DEPENDENCY_UNAVAILABLE – OCR/broker/storage or simulated bank failure; no false success.

Standard error payload: error.code, safe error.message, error.field_errors, request_id and optional retryability hint. Do not echo raw SQL errors, storage paths, credentials or arbitrary exception text to the browser.


## 12.2 Response example: evidence transparency

{
  "data": {
    "fdr_id": "uuid",
    "instrument_status": "ACTIVE",
    "review_status": "ACCEPTED",
    "bank_verification": {
      "status": "MOCK_MATCH",
      "source_kind": "MOCK_BANK",
      "is_simulated": true,
      "scenario_id": "MATCH_WITH_ACTIVE_LIEN",
      "verified_at": "2026-10-26T10:00:00Z"
    },
    "document_extraction": {
      "status": "READY",
      "principal_amount": "2500000.00",
      "source_page": 1,
      "confidence": 0.94
    },
    "version": 7
  },
  "meta": {"request_id": "req-example", "as_of": "2026-10-26T10:01:00Z"}
}

Warning about this illustrative example: An ACTIVE status in a demo using mock evidence represents only a synthetic scenario and demo administrative acceptance; it must never be confused with production authenticity assurance. Keep environment and provenance context in official-facing displays and exports.


# 13. Python / FastAPI source organization and engineering standards

backend/
  app/main.py
  app/core/config.py                 # Pydantic settings and environment gates
  app/core/security.py               # Auth / CSRF / session policies
  app/core/authorization.py          # Authorize(actor, action, resource)
  app/api/v1/routers/                # Thin typed HTTP handlers
  app/domains/institutions/           # Entities, use cases and repositories
  app/domains/fdr/                    # Lifecycle, submissions, versions
  app/domains/documents/              # Upload, scan, parse, extraction
  app/domains/verification/           # Provider port, mock adapter, checks
  app/domains/releases/               # Clearances, maker-checker decisions
  app/domains/notifications/          # Thresholds, templates, outbox
  app/domains/audit/                  # Append-only activity
  app/domains/risk/                   # Versioned deterministic rules
  app/infrastructure/db/             # SQLAlchemy engine/session/models
  app/infrastructure/storage/        # Private object adapter
  app/infrastructure/queue/          # Worker tasks and scheduler
  app/infrastructure/email/          # Reviewed notification sender
  migrations/                        # Alembic migrations
  tests/unit/                         # Pure domain/state-rule checks
  tests/integration/                  # PostgreSQL/API/worker contract checks
  tests/security/                     # BOLA, CSRF, upload abuse tests
  tests/e2e/                          # Seeded end-to-end flows
  docs/adr/                           # Architecture decision records
  docker-compose.yml

Implementation discipline: API handlers parse/auth/delegate; business rules live in domain services; repositories do I/O and enforce transaction boundaries; queue tasks call idempotent application services; Pydantic schemas distinguish create, patch, response and internal evidence. Avoid direct db.commit() calls from every route and background task; one use-case owns the transaction. Type-check and lint (ruff, mypy or Pyright), pin dependencies, disallow wildcard imports and raw SQL string interpolation.


## 13.1 Async and performance reality

FastAPI async does not make CPU-heavy OCR concurrent for free. Use async when waiting on external I/O through async-native clients; perform CPU-intensive rasterization/OCR in isolated worker processes. A single async endpoint calling blocking pytesseract will stall its event loop. External bank APIs may be slow, but demo uses a controlled simulator; timeout, retry budget and circuit breaker are still worthwhile in the adapter contract.


## 13.2 Why not microservices first?

The system has domain boundaries but does not yet justify independently deployed services, numerous credentials, tracing propagation and distributed transactions. A modular monolith with private workers is easier to audit, test and deploy correctly. Split the bank connector or document processing later only if security/isolation/performance evidence calls for it.


# 14. Observability, alerting, backup and incident response


## 14.1 Operational visibility

Metrics: http_requests_total, API p50/p95/p99 latency by route/status, auth denials, BOLA test alerts, upload scan failures, OCR job duration/error counts, queue depth/age, stale jobs, mock-bank outcome counts, notification lag, clearance SLA age and outbox undispatched age. Structured log fields: timestamp, service, environment, request ID, trace ID, actor pseudonymous ID, institution scope ID if approved, action, outcome, duration and safe error code. Logs must not include bearer tokens, full FDR numbers, raw PDFs or request bodies by default.


## 14.2 Reliability SLO proposals (not official SLA)

Availability target for a mature deployment to be agreed; hackathon target: demonstrable recovery and graceful failure, not invented 99.99% uptime.

API p95 for indexed ordinary list/detail under controlled synthetic load: aspirational ≤500–800 ms excluding large document transfers and OCR.

Upload confirmation: immediate metadata/session response; large object transfer bypasses API.

Background scan/OCR: bounded by file size and worker budget, explicit processing state; do not promise a fixed 2-second OCR result.

Notification accuracy: zero duplicate logical reminder events across repeated scheduler runs in integration tests; delivery timing depends on provider availability.

Recovery: choose acceptable RPO/RTO with actual authority; test backup restore before claiming readiness.


## 14.3 Backup and disaster recovery

PostgreSQL continuous backup/PITR where supported; encrypted snapshots; object-storage version protection, restricted delete rights, audit backup separately, restore verification on a schedule, documented recovery order, controlled key escrow and test of partial/corrupt backup. Recovery must restore both database metadata and matching document object versions; orphaned documents and missing keys are explicit incident scenarios. Avoid replication alone as a backup strategy.


## 14.4 Incident-response playbooks

At minimum: suspected data exposure, compromised officer account, corrupted financial document, false bank-verification claim, release approval bypass, runaway OCR denial of service and missing maturity notifications. Each runbook specifies detection, initial containment, evidence preservation, role suspension/credential rotation, scope assessment, restoration, communication and applicable reporting escalation. Confirm reporting duties with competent security/legal teams; do not claim automatic CERT-In compliance from writing a runbook.


# 15. Testing strategy, security gates and acceptance criteria


## 15.1 Unit and property tests

State-machine transitions (valid/invalid), amount/date validators, policy-version selection, rule-engine findings, renewal linkage and cycle detection, unique reminder dedupe, maker-checker constraints, permission boundary predicates, simulated response provenance and checksum verification. Add property-based tests for dates, amounts and transition invariants where useful.


## 15.2 Integration tests

PostgreSQL transaction rollback leaves no unaudited state change; concurrent officers cannot both finalize the same request; retrying upload finalize does not duplicate document; duplicate S3 events process once logically; row-level access denies guessed institution ID; Redis outage does not lose authoritative maturity records; broken scan never marks a document clean; mock signature replay/tamper is rejected; exports are restricted by scope and recorded; replacement updates future reminders without erasing history.


## 15.3 Security verification matrix


| Test | Expected outcome | Gate |
| --- | --- | --- |
| Institution A requests Institution B instrument | 403/opaque 404, no object key or data leakage | P0 |
| Official without assignment posts acceptance | Denied and recorded; no state update | P0 |
| Maker attempts self-checker release approval | Denied server-side | P0 |
| CSRF request against state-changing cookie route | Denied | P0 |
| Malicious/oversize/non-PDF upload | Quarantined/rejected; parser not invoked | P0 |
| Replayed/tampered mock bank result | Rejected and security event created | P0 |
| Two concurrent approve calls | Only one accepted transition and audit chain | P0 |
| Database commit fails after attempted audit insert | Whole transition rolled back | P0 |
| Redis broker loses availability during scheduler | Authoritative due state remains; replay possible | P0 |
| Export link used after revocation/expiry | Denied under policy | P0 |
| Dependency scan detects critical vulnerable package | Release blocked until remediated/accepted by process | P0 |
| Source maps/debug documentation exposed publicly | Deployment gate flags misconfiguration | P1 |


Security evidence package should include automated SAST, dependency/SBOM review, secret scanning, API DAST checks, OWASP ASVS-derived manual tests and an independent review if a government pilot becomes realistic. Never assert “military-grade” or “zero-trust compliant” without tested criteria.


## 15.4 End-to-end SIH scenarios

S1 — Successful synthetic submission: institution logs in, creates FDR draft, uploads clean sample, confirms OCR, submits; officer reviews, mock check returns match, accepted state recorded with simulation disclaimer. S2 — Document mismatch: entered amount differs, finding created, clarification issued, corrected document version preserved. S3 — Maturity: an FDR due in 12 days generates deduplicated notice, action owner and priority finding. S4 — Replacement: successor link inserted; prior evidence persists; due schedule updated. S5 — Blocked release: missing PGRC/Vigilance/other configured clearance blocks approval. S6 — Permitted demo release: separate authorized roles complete clearances/maker-checker; action audit recorded; no money transferred. S7 — Security boundary: Institution A guesses Institution B ID; denied; no data. S8 — Recovery: OCR or mock bank times out; case remains accurate, retryable, traceable.

Measure at least: field extraction match rate by sample type, reconciliation time per case, user task time for maturity lookup, duplicate-reminder count and authorization denial behavior. Use a transparent small test set and publish test definitions; never invent performance/accuracy metrics.


# 16. Implementation roadmap and priorities


| Phase | Deliverables | Completion gate |
| --- | --- | --- |
| 0: Rules and threat model | Data classification, workflow state map, clearance policy assumptions, roles matrix, security baseline | Team agrees no real bank auth and no direct fund movement |
| 1: Foundations | FastAPI, DB/migrations, IdP/session, authorization service, audit+outbox, private storage | Cross-tenant and state-tamper tests pass |
| 2: Deposit workflow | Institution/FDR registry, draft/upload, scan/OCR, evidence extraction, submission | S1 + S2 work with durable states |
| 3: Verification & monitoring | Mock bank adapter, evidence provenance, anomaly rules, scheduler/reminders | S3 + S8 work; mock claim never mislabeled |
| 4: Clearance & release | Renewal links, release case, policy checklist, maker/checker workflow | S4 + S5 + S6 work; invalid decisions blocked |
| 5: Hardening/demo | Scoped exports, backups, end-to-end tests, error taxonomy, load/security smoke test | S7 and security matrix P0 checks pass |


MVP required: protected sign-in, scoped FDR records, secure PDF upload, parsing and evidence, simulated verification, officer scrutiny, maturity alerts, replacement linkage, controlled release/clearance and audit. Defer: custom fraud models, live banking, real-money integration, multi-region active-active, elaborate analytics, service mesh and WebSockets unless core acceptance criteria are already met.


# 17. Security/architecture decisions requiring authorization

Official hosting and data residency: approved environment, storage region, access, contractor controls and backup locality.

Identity federation: whether AICTE-approved IdP, official SSO/MFA and delegated institution identity are available.

Applicable regulatory policy: correct APH year, case type, release forms, renewal/replacement treatment, mandatory clearances and decision authority.

Integration feasibility: legal agreement and technical specification for official bank verification; none assumed.

Evidence retention: lawful retention, legal hold, public-record considerations and redaction rights.

Auditor rights: permitted access to personal data, document downloads and exports.

Production security assessments: government security approvals/certification pathways, incident reporting and vulnerability-response ownership.

Notification channels: authorized relay/provider, templates, classification and message retention.

Business continuity: approved RTO/RPO, backup operator segregation and incident drill frequency.

Demo release semantics: ensure synthetic case approval is not presented as real regulatory authorization or financial discharge.


# 18. Architectural review checklist / definition of done

☐ SIH26265 title, issuer and complete lifecycle are represented in product and repository docs.

☐ No fake “authentic” bank result: simulated provider is explicitly typed, stored and displayed.

☐ Institution, regional/bureau scope and assigned cases are enforced server-side on every route.

☐ Critical release actions require reasons, configured clearances and maker-checker separation.

☐ Original uploaded documents and replacement histories cannot be silently overwritten.

☐ PostgreSQL mutation and audit event are atomic; outbound notifications use outbox/retry.

☐ Presigned uploads are quarantined, validated and scanned before any viewing/processing.

☐ OCR provenance and uncertainty are available to reviewer; no auto-fraud claim.

☐ Mature/expiring date alerts are based on authoritative DB state and deduplicated.

☐ Data-at-rest/in-transit security, secret management and log redaction have concrete tests.

☐ Recovery, authorization-denial, timeout, concurrency and invalid-transition tests pass.

☐ Frontend label/status vocabulary matches backend DTOs and release semantics.

☐ Synthetic demo dataset and clear limitation disclaimer are packaged with deployment.

☐ Security and accessibility standards referenced without claiming unsupported certification.


# 19. Implementation patterns and code examples (Python 3.12+, FastAPI, SQLAlchemy 2, Pydantic 2)

Reading this appendix: examples illustrate secure architecture boundaries. They are reference snippets, not a copy-paste deployable government system: imports/models referenced across snippets need to be implemented in the repository, configuration needs approved secrets, and security, integration and concurrency tests must pass before use. All account, institution, banking and FDR values are synthetic. Use supported patched releases; verify exact pins at the time of deployment.


## 19.1 Suggested repository, dependency strategy and execution plan

```text
koshsetu/
  apps/
    api/app/
      main.py
      api/v1/{fdrs,uploads,verification,releases,notifications}.py
      core/{settings,security,permissions,logging}.py
      db/{base,session,models,migrations}.py
      domains/
        fdr/{schema,service,repository,policy}.py
        document/{upload,scan,extract,evidence}.py
        bank/{ports,mock_adapter,bank_adapter}.py
        release/{service,policy,events}.py
        risk/{rules,engine}.py
        notification/{service,events}.py
      workers/{celery_app,tasks,beat_schedule}.py
    web/                 # Next.js App Router, BFF, UI
  tests/{unit,integration,security,e2e}/
  infra/{containers,iam,network,monitoring}/
  docs/{openapi,adr,threat-model,runbooks}/
```

Dependency strategy: Python 3.12+ where every chosen wheel and production image supports it; Pydantic 2 APIs (model_validate, field_validator), SQLAlchemy 2 typed ORM (Mapped, mapped_column, select), Alembic reviewed revisions, current FastAPI dependency injection, Celery 5.6.x stable, PostgreSQL and Redis from supported patched lines. Default to a modular monolith and separate asynchronous workers. Use uv.lock (or equivalent lockfile), a JS lockfile, pinned container digests and an SBOM. Do not auto-upgrade in production without testing.

# Example local setup; choose supported exact pins before freeze.
uv venv
uv add fastapi 'uvicorn[standard]' 'sqlalchemy[asyncio]' \
  asyncpg pydantic-settings alembic pyjwt 'pwdlib[argon2]'
uv add celery redis boto3 pymupdf python-magic
uv add --dev pytest pytest-asyncio httpx ruff mypy
uv lock
uv run alembic upgrade head
uv run uvicorn app.main:app --reload  # LOCAL ONLY

The API should not expose automatic Swagger/docs publicly in a real restricted deployment. In the prototype, keep it reachable only in the development environment or via authorized internal access. Preserve a reviewed OpenAPI artifact in docs/openapi/.


## 19.2 Environment configuration with explicit validation

# app/core/settings.py
from functools import lru_cache
from pydantic import SecretStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env', extra='forbid', case_sensitive=False
    )
    environment: str = Field(pattern='^(local|demo|production)$')
    database_url: SecretStr
    redis_url: SecretStr
    s3_bucket: str
    s3_region: str
    oidc_issuer: str
    oidc_audience: str
    mock_bank_enabled: bool = False

@lru_cache
def settings() -> Settings:
    cfg = Settings()  # type: ignore[call-arg]
    if cfg.environment == 'production' and cfg.mock_bank_enabled:
        raise RuntimeError('Mock bank must never run in production')
    return cfg

Do not place .env files or cloud keys in source control. The production secrets source should be an approved key/secret manager with rotation, separation of duty and a limited runtime service identity. The production policy can choose to disable all bank-check functionality until formal bank authorization exists.


## 19.3 A Pydantic request that rejects invalid financial records


Server derives the institution ID from an authenticated scoped assignment, not a client-supplied institution_id on ordinary institution routes. Decimal is serialized as a string for deterministic financial values in API contracts. Never store money as binary floating-point numbers.


## 19.4 SQLAlchemy 2.0 model excerpt and safe session lifecycle


The snippet assumes DB_URL is loaded securely from validated configuration and an institutions table exists. Create a new AsyncSession per request/task and never share a session concurrently between multiple asyncio tasks. FastAPI request dependency:


Indexes: separate scope and due-date indexes such as (institution_id, maturity_date) after checking execution plans. Do not globally expose FDR identifiers or raw search terms. Each financial decision also needs a version or row lock.


## 19.5 Resource-level authorization: correct example


Important: Principal must be created by a validated OIDC/session authentication component and should resolve up-to-date assignment data on privileged requests; never accept the principal or permission sets directly from a browser request. For officers with regional jurisdiction, convert assignments into an equivalent authorized database-scoped predicate; a purely role-based AICTE_OFFICIAL check is insufficient. Do not leak cross-institution existence through errors. RLS can provide defense in depth if tested and configured for each connection/transaction, but is not a substitute for application authorization.


## 19.6 Authentication design for a government-sensitive web client

Preferred production pattern: approved OIDC/SAML identity provider, MFA, enterprise conditional access and session revocation, BFF between browser and FastAPI when feasible. Browser gets a Secure/HttpOnly/SameSite session cookie; backend handles service-to-service credentials. If SPA direct token authorization is unavoidable, use short-lived access tokens, rotation, revocation/replay detection and robust CSRF safeguards for cookie-authenticated endpoints. JWT signature alone does not guarantee a current role or allowed institution. Use explicit iss, aud, exp, token-type and key-ID validation; do not accept arbitrary JWT algorithms from token headers.

Browser -> BFF: Cookie (HttpOnly, Secure, SameSite) + CSRF token
BFF -> Identity Provider: verified OIDC sign-in + MFA
BFF -> FastAPI: service credentials + validated user context
FastAPI -> PostgreSQL: current institution/case authorization
FastAPI -> audit_events: actor + action + reason + correlation

A sample FastAPI OAuth2/JWT tutorial can guide local demo auth, but it is not a replacement for a government-approved identity provider. Reference: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ . Use pwdlib[argon2] for local demo passwords if password storage is needed (the official tutorial presently favors pwdlib and PyJWT).


## 19.7 Presigned document upload: use POST policy conditions and quarantine

For browser uploads, prefer a short-lived presigned POST with size/metadata conditions, which is convenient for enforcing a content-length-range in the S3 policy. A simple PUT presigned URL does not by itself enforce a file-size rule in the same way. The backend still validates every stored object after upload and never trusts browser claims.


Still required: authenticated upload-session record, tenant ownership of generated key, quotas, bucket private policy, encryption, storage-event/finalize replay protection, SHA-256 verification, magic-byte/content validation, antivirus, PDF parser limits and permission checks on document access. A generated POST form is not a virus scanner. The 10 MB limit is a demo example, not an AICTE policy limit.


## 19.8 OCR pipeline: extraction is not bank authentication

Indian Banking Document Realities: Physical FDR receipts from Indian banks (SBI, PNB, Canara, etc.) often feature colored rubber stamps over FDR numbers or principal amounts, bilingual layouts (Hindi/English), and low-contrast dot-matrix printing. Preprocessing utilizes OpenCV color thresholding (HSV space) to isolate text from colored ink stamps, and Tesseract is configured for eng+hin. Any extracted field with confidence < 0.85 requires mandatory visual human-in-the-loop confirmation.


Run PDF parsing in a resource-constrained isolated worker only after the object is cleared by scanning. If native extraction is empty or unreliable, rasterize only necessary pages at bounded DPI and run OCR. Persist field provenance document_id, file hash, page index, source region, original text, normalized value, model/parser version and confidence. Escalate low confidence for manual confirmation. Never run arbitrary PDF embedded scripts, shell commands constructed from filenames, or unbounded image conversions.


## 19.9 Mock bank adapter: explicit source classification and deterministic test cases


Scenario catalog: MATCH_AND_LIEN_CONFIRMED, AMOUNT_MISMATCH, REFERENCE_NOT_FOUND, LIEN_NOT_CONFIRMED, BANK_TIMEOUT, MALFORMED_RESPONSE, RATE_LIMITED, VERIFICATION_UNAVAILABLE. All fixtures are deterministic and allow the team to demonstrate each branch. A separate authorized production adapter would require genuine banking credentials, service-to-service authentication/mTLS as mandated, an approved contract, network allowlisting, schema validation, timeout/circuit breaker and data-handling controls. The mock adapter must be disabled by configuration in the real production environment and its outputs must never be reclassified as AUTHORIZED_BANK.


## 19.10 Version-aware review command and maker-checker release logic

A financial decision must be transactional and conditional, not a sequence of independent writes. The API must re-check current actor scope and all policy prerequisites inside the transaction.


Required infrastructure behind this pseudocode: explicit DB uniqueness for command receipts, policy snapshot and clearance rows locked or validated under an isolation/constraint scheme preventing a conflicting change, rollback on all failures, version/conflict responses (409), audit integrity, and a separately authorized command to record subsequent bank-side completion if a real confirmation arrives. Do not use REQUEST_APPROVED to mean money has moved. Do not send email before the transaction commits. A simple lock on release_requests alone is not sufficient if clearance rows can change concurrently; define lock ordering and tests for those interleavings.


## 19.11 Scheduled maturity reminders: authoritative database and dedupe

-- PostgreSQL: illustrative SQL, index and policy conditions omitted.
INSERT INTO notification_events
    (fdr_id, event_type, due_date, dedupe_key, status)
SELECT f.id,
       'MATURITY_30_DAYS',
       f.maturity_date,
       'M30:' || f.id::text || ':' || f.maturity_date::text,
       'QUEUED'
FROM fdrs AS f
WHERE f.maturity_date BETWEEN CURRENT_DATE
                         AND CURRENT_DATE + INTERVAL '30 days'
  AND f.instrument_status = 'ACTIVE'
ON CONFLICT (dedupe_key) DO NOTHING;

Interpretation: the query above enumerates every active FDR within 30 days, and a single M30 key prevents duplicates. Production business logic must decide whether to send the 30-day notice only at the threshold, how to handle newly submitted within-window cases, a renewed maturity date, repeated reminders, weekends/time zones and overdue escalations. Implement separate event types M30, M7, M1, OVERDUE and ensure due-state transitions are correct per local Indian business calendar when required. The unique constraint and outbox dispatcher (not Redis ZSET removal) supply durable deduplication.


Celery executes at-least-once work in failure cases; acks_late does not magically create exactly-once side effects. The send-once service must use DB state, provider dedupe support, lease expiry/recovery and a well-defined retry policy. Avoid a synchronous email send inside an API transaction.


## 19.12 Explainable integrity engine: evaluate findings, not a fraud score


The actual engine must version its rules, attach source/check IDs, ensure deterministic recomputation, distinguish OCR uncertainty, respect case type and not treat a date or mismatch as proof of fraud. Record a human disposition with reason (accepted false positive, resolved, remains open) and re-open the finding when evidence changes.


## 19.13 API request/response samples and error semantics

POST /api/v1/fdrs/019d.../verification/mock
Cookie: <omitted browser session>
X-CSRF-Token: <redacted>
Idempotency-Key: 226b... (generated once per command)
Content-Type: application/json

{"scenario":"AMOUNT_MISMATCH"}

{
  "check_id": "9a8e-example",
  "source_kind": "MOCK_BANK",
  "simulation": true,
  "scenario_id": "AMOUNT_MISMATCH",
  "outcome": "DISCREPANCY",
  "checked_at": "2026-10-26T13:00:00Z",
  "message": "Demonstration only; not bank authentication"
}

Never expose this route outside the authorized demonstration environment, and prohibit institutions from choosing results of an official bank check. The mock scenario selector is an explicit fixture control for the SIH demonstration only. Status codes: 202 queued, 200 read, 201 created, 400 invalid syntax, 401 unauthenticated, 403 forbidden, 404 out-of-scope/not found, 409 stale version or blocked transition, 422 semantic validation, 429 throttled, 503 unavailable dependency. An error body includes safe code, message, request_id, optional field errors and no secrets.


## 19.14 Tests that protect the core regulatory invariants


The async tests above depend on fixtures client, synthetic seeded tenants and a fully wired application. Add concurrent integration tests for duplicate idempotency key, final approval racing a clearance reversal, two officers approving simultaneously, lost Celery acknowledgment, S3 replay event, revoked role downloading a PDF, malicious PDF and record version conflict. Use disposable databases and deterministic clock fixtures.


# 20. Security controls mapped to threats, tests and evidence


| Threat / failure | Required defense | Verification evidence |
| --- | --- | --- |
| Stolen or replayed session | OIDC/MFA, Secure HttpOnly cookies, CSRF, short TTL, revocation | Session fixation/replay tests, revocation tests |
| Institution-to-institution data access | Explicit SQL-scoped authorization on every route | IDOR/BOLA adversarial test with two synthetic tenants |
| Insider self-approval | Maker/checker, assigned authority, transactional prerequisites | Same-actor conflict and two-user workflow test |
| Arbitrary PDF exploit | Quarantine, AV, validated type, sandbox, parser limits | Malicious PDF corpus + worker resource monitoring |
| Forged bank response | Service identity, provenance flag, signed/validated origin | Mock-to-authorized promotion forbidden test |
| Alert loss on worker failure | Durable DB events, outbox, retriable idempotent workers | Crash-after-send/crash-before-ack injection tests |
| Audit alteration | Append-only write authorization, integrity digest, backup controls | Denied update/delete, chain verification, restores |
| Sensitive log exposure | Redaction, correlation IDs, access limits, retention policies | Log scanning and telemetry integration tests |
| Host compromise/lateral movement | Segmented networks, minimal IAM, non-root containers | IaC policy and container vulnerability scans |
| SSRF/object storage exfiltration | Allowed destinations, no arbitrary URL fetch, short-lived access | Malicious URL and storage permission tests |
| Duplicate financial transitions | Row locks, DB constraints, command deduplication | Parallel requests and rollback invariants |
| Unauthorized export | Scope checks, watermark, rate limits, expiring downloads | Cross-scope report tests and revoke-during-export |


Assurance baseline: OWASP ASVS 5.0.0 stable (verified 26 Oct 2026), plus OWASP API Security guidance, formal threat modeling, SAST/dependency scan/secret scan, authorization-focused penetration testing and remediation tracking. Government context: GIGW 3.0, relevant CERT-In directions and competent-owner approval. Compliance claims require an actual audit; this project brief does not certify the system.


# 21. Production-oriented deployment, observability and disaster recovery


## 21.1 Trust-zone topology (textual architecture diagram)

[Browser / Institute Officer / AICTE Official]
            |
            v
  [TLS edge + WAF + rate limits]
            |
       [Next.js BFF] ----- [OIDC identity provider/MFA]
            |
  [Internal authenticated API gateway]
            |
       [FastAPI API pods] ------------ [Private PostgreSQL]
            |          \               [Private Redis/broker]
            |           \              [Audit event store]
      [Event/outbox]     [Private S3/quarantine]
            |                       |
      [Celery workers] <----- [scan + OCR sandbox]
            |
      [Mail / Mock bank adapter (DEMO ONLY)]

Security boundary notes: DB, queue and S3 are not publicly routable; service roles have only needed object keys and database privileges; transport encrypted; container file systems read-only where possible; separate upload scanning workers from the API; disable shell access and cloud metadata exposure; secrets rotated, not image-baked. An allowed production bank adapter is isolated behind a service interface, not shipped as an open internet call from the browser.


## 21.2 Audit and observability fields

Every protected request logs request_id, authenticated subject surrogate, allowed institution scope, case reference, action, decision (allow/deny), latency bucket and correlation IDs. Exclude full FDR numbers, PDF text, bearer credentials, signed URLs, passwords, bank payloads and raw personally identifiable information. Trace spans for upload/scan/OCR/verification/outbox deliveries must propagate a safe correlation ID. Use metrics for queue lag, processing failure, authentication anomalies, scope denials, overdue actions and permission-denied spikes. Alerts must have a named on-call owner.


## 21.3 Reliability expectations

Proposed internal engineering targets, not AICTE SLAs: p95 read API under 500 ms on a warm controlled test system for indexed queries; no corrupted audit events on failure injection; 100% demonstration of correct role isolation; zero unscanned document rendering; reliable retries for reversible background tasks; measurable OCR field accuracy on a labeled synthetic set. Do not sacrifice security checks to meet latency. Capture test environment, load shape and dataset before reporting metrics.


## 21.4 Backup, retention and incident operations

Define recovery point/recovery time objectives with government owner. Encrypt database backups and object versions, test restores into isolated environment, preserve audit continuity, and conduct tabletop scenarios for compromised credentials, forged documents, unexpected data export and leaked presigned URLs. Official CERT-In reporting requirements and data retention/legal-hold periods must be interpreted by legal/security owners; never invent fixed mandatory durations in code.


# 22. Sprint-by-sprint reference implementation and review gates


| Sprint | Technical deliverable | Security/correctness gate |
| --- | --- | --- |
| 0 | Threat model, ADRs, status policy and mock-bank trust contract | Architecture review, no unsupported government claims |
| 1 | OIDC/demo auth, institutions, scoped roles, migrations | Cross-tenant read/write denied; privilege tests |
| 2 | Quarantined uploads, scan worker, field extraction evidence | No unscanned render; file replay and malicious file tests |
| 3 | FDR registry, review state machine, versioned decisions | Concurrent mutations, audit + outbox atomicity |
| 4 | Mock bank fixture adapter and risk engine | Simulation cannot be promoted; evidence is traceable |
| 5 | Maturity reminders and renewal links | Dedupe, worker crash and stale maturity tests |
| 6 | Clearance-based release and maker-checker | Impossible self-approval; hold is non-bypassable |
| 7 | CI security gates, dashboard metrics, E2E and demo | Threat remediation, backup restore, accessibility integration |


Code review policy: at least two reviewers for authorization, release decisions, audit storage, credential management and migration changes. No code shortcut may bypass scope checks even for demonstration endpoints. Keep a small, reproducible synthetic fixture set with expected responses for all happy and failure paths.


# 23. Up-to-date official documentation and implementation reading order

Checked on 26 October 2026; URLs point to maintained documentation, not immutable releases. Versions are intentionally described as verified families where precise latest patches can change. The final dependency file must pin exact tested patches, and all new dependency advisories must be checked in CI.


| Order | Technology / control | Primary official documentation | Application to this portal |
| --- | --- | --- | --- |
| 1 | FastAPI | https://fastapi.tiangolo.com/ | Routing, DI, validation, OpenAPI |
| 2 | FastAPI OAuth2/JWT | https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ | Demo-only auth reference; OIDC for production |
| 3 | Pydantic 2 | https://docs.pydantic.dev/latest/concepts/validators/ | Financial field validation |
| 4 | SQLAlchemy 2 session | https://docs.sqlalchemy.org/en/20/orm/session_basics.html | Transactions and AsyncSession lifetime |
| 5 | SQLAlchemy 2 ORM | https://docs.sqlalchemy.org/en/20/orm/quickstart.html | Typed declarative models |
| 6 | Alembic | https://alembic.sqlalchemy.org/en/latest/ | Schema migrations |
| 7 | PostgreSQL | https://www.postgresql.org/docs/current/ | Locking, constraints, indexing, RLS |
| 8 | Celery 5.6 | https://docs.celeryq.dev/en/stable/ | At-least-once task execution and retry |
| 9 | Celery tasks | https://docs.celeryq.dev/en/stable/userguide/tasks.html | Idempotence, acknowledgment, retries |
| 10 | AWS S3 presigned upload | https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html | Secure upload architecture |
| 11 | AWS S3 POST policy | https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html | Signed content-length conditions |
| 12 | S3 event notifications | https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html | Event-driven scanning and deduping |
| 13 | PyMuPDF | https://pymupdf.readthedocs.io/en/latest/ | Native PDF extraction and evidence page region |
| 14 | OWASP upload cheat sheet | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html | Reject malicious files and unsafe file use |
| 15 | OWASP ASVS 5.0 | https://asvs.owasp.org/ | Security acceptance controls |
| 16 | OWASP API Security | https://owasp.org/API-Security/ | BOLA/IDOR, broken auth, rate limiting |
| 17 | GIGW 3.0 | https://guidelines.india.gov.in/ | Government UX/security/accessibility |
| 18 | CERT-In | https://www.cert-in.org.in/ | Incident handling and applicable directions |
| 19 | Next.js data security | https://nextjs.org/docs/app/guides/data-security | BFF and user-scoped rendering |
| 20 | OpenTelemetry Python | https://opentelemetry.io/docs/languages/python/ | Distributed traces without secrets |
| 21 | pytest | https://docs.pytest.org/en/stable/ | Test fixtures and integration testing |
| 22 | Ruff | https://docs.astral.sh/ruff/ | Lint/format CI gate |
| 23 | Python type checker | https://mypy.readthedocs.io/en/stable/ | Business logic type assurance |


Release notes verified: official Celery documentation describes the stable 5.6 series; official OWASP material lists ASVS 5.0.0 as stable; the FastAPI security tutorial now uses PyJWT and pwdlib[argon2]; SQLAlchemy 2 documentation explicitly warns not to share AsyncSession across concurrent tasks. Confirm available patched versions at the date of installation rather than treating this document’s date as a permanent latest-version assertion.


# 24. Original references and design provenance

SIH official portal — https://www.sih.gov.in/sih2026PS (canonical problem-statement entry; retrieval access limited during drafting).

SIH26265 reproduced description — https://zaidsayyed.in/tools/sih-problem-statements/sih26265 (reviewed 26 October 2026; secondary capture, not policy authority).

GIGW 3.0 government guidelines — https://guidelines.india.gov.in/ (official guidance on accessible, secure government sites and applications).

OWASP Application Security Verification Standard 5.0 — https://asvs.owasp.org/ (secure development/test baseline).

AICTE Approval Process Handbook (2024–27) — https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf (reference for release documentation/clearances; confirm currently effective clauses and exceptions).

CERT-In cyber directions and advisories — https://www.cert-in.org.in/ (consult current obligations with authorized security personnel).

W3C Web Content Accessibility Guidelines — https://www.w3.org/TR/WCAG22/ (frontend accessibility target, coordinated with GIGW).

Inter-document contract: the companion Frontend Product & UI/UX Specification | SIH26265 uses the same role model, separate status dimensions, simulated-bank labeling, FDR evidence structure, threshold/deduped notifications, release checklist and action semantics. Changes to any of these contracts must be reviewed in both documents.
