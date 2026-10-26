# Architecture notes

Companion to the two specification documents in this repository
(`AICTE_SIH26265_Backend.docx`, `AICTE_SIH26265_Frontend.docx`). This file records what the
prototype actually implements, and where it deliberately stops short.

## 1. Shape

A modular monolith with isolated domains, chosen over microservices because the system has domain
boundaries but no operational need yet for independently deployed services, extra credentials and
distributed transactions.

```
Browser (institution / official)
   │  HTTPS, HttpOnly session cookie, CSRF double-submit on writes
   ▼
Vite dev proxy (same origin) ──► FastAPI
   │                               ├─ core/authorization   authorize(actor, action, resource)
   │                               ├─ domains/fdr          lifecycle, submissions, versions
   │                               ├─ domains/documents    upload, scan, extract, evidence
   │                               ├─ domains/bank         provider port + mock adapter
   │                               ├─ domains/release      checklist, clearances, maker/checker
   │                               ├─ domains/risk         versioned deterministic rules
   │                               ├─ domains/notifications thresholds + outbox
   │                               └─ domains/audit        append-only, digest chained
   ▼                                        │
Private object store (quarantine/clean)     ▼
                                    SQLite (demo) / PostgreSQL (deployment)
```

### Deviations from the brief, and why

| Brief | Here | Reason |
| --- | --- | --- |
| PostgreSQL | SQLAlchemy 2 against SQLite by default, PostgreSQL via `KOSHSETU_DATABASE_URL` | The prototype must run with no services. The ORM, constraints and transaction boundaries are portable. |
| Alembic migrations | `Base.metadata.create_all` at startup | A single-schema prototype. A deployment needs reviewed revisions before anything else. |
| Celery + Redis workers | In-process scanning and extraction; the outbox and maturity scan run on demand through `/ops/*` | Keeps the demo to two processes. The job boundaries, idempotency keys and dedupe keys are already in the data model, so moving them to a worker is a transport change, not a redesign. |
| S3 + presigned POST | Local private store with generated quarantine keys and an upload-session gate | Identical trust properties locally: generated keys, server-side validation after transfer, no browser-visible storage URL. |
| PyMuPDF + OCR | `pypdf` native text extraction; image-only pages are escalated for manual review | Avoids a heavy native dependency. The pipeline reports *not found* rather than inventing a value, which is the property that matters. |
| Next.js App Router + BFF | Vite + React, API proxied at the same origin | The repository's existing frontend was Vite. The security-relevant part — an HttpOnly cookie, CSRF on writes, no token in storage — is unchanged. |

## 2. Status dimensions

The brief's central correctness requirement: no single overloaded status.

| Dimension | Controlled by | Example values |
| --- | --- | --- |
| `submission_status` | institution + scrutiny | DRAFT, UPLOADED, SUBMITTED, CORRECTION_REQUESTED |
| `document_processing_status` | scanner / parser | QUARANTINED, EXTRACTING, READY, MANUAL_REVIEW_REQUIRED, REJECTED |
| `bank_verification_status` | bank adapter | NOT_REQUESTED, MOCK_MATCH, MOCK_MISMATCH, MOCK_ERROR, REJECTED_BY_PORTAL |
| `review_status` | authorised officials | QUEUED, IN_REVIEW, CLARIFICATION_REQUIRED, ACCEPTED, REJECTED |
| `instrument_status` | state machine | REGISTERED, ACTIVE, SUPERSEDED, RELEASE_RECORDED, ARCHIVED |
| `lien_status` | declared or bank source | UNKNOWN, CLAIMED, CONFIRMED, DISPUTED, RELEASED |
| `release_status` | clearance / maker-checker | REQUESTED, DOCUMENTS_PENDING, CLEARANCES_PENDING, ON_HOLD, READY_FOR_DECISION, APPROVED, REJECTED |

*Maturing* is derived from `maturity_date` against today — never a stored state. *Matured* does not
imply money moved; *RELEASE_RECORDED* means an administrative decision exists, nothing more.

## 3. Authorization

`Principal` is built only from a validated session: roles, institution ids, region codes and bureau
codes come from active `role_assignments`, never from the request body. Each route asks for a
capability, then scopes its query:

- An institution user sees only its own institution's rows.
- An officer with regional scope sees only institutions in that region.
- An out-of-scope id returns 404 — existence is not confirmed to an unauthorised caller.
- Bureau clearance decisions require the actor to be assigned to that specific bureau.
- A denied privileged attempt is written to the audit trail without sensitive content.

UI route guards and hidden controls mirror this, and are treated as convenience only.

## 4. Sensitive identifiers

The full FDR number never leaves the server:

- `fdr_number_ciphertext` — application-layer envelope (a KMS in a deployment).
- `fdr_lookup_hash` — HMAC-SHA256 over a canonicalised issuer + number, for exact search and
  duplicate *candidates*. A matching token raises `DUP-001` for manual investigation; it is never
  treated as proof, because bank number formats can collide.
- `fdr_number_masked` — the only form rendered, logged or exported.

Extraction provenance for the number field is masked before it is returned, which a test enforces.

## 5. Documents

1. `POST /upload-sessions` validates scope, type and size, and reserves a generated quarantine key.
2. The object is transferred, then validated server-side: size, magic bytes, PDF structure,
   encryption, active content (`/JavaScript`, `/Launch`, `/EmbeddedFile`, `/OpenAction`), page count.
3. A clean verdict promotes the object to the clean namespace and runs extraction; any other verdict
   moves it to the rejected namespace and leaves the instrument un-renderable.
4. Finalising twice returns the same document rather than creating a second one.
5. Reading requires a two-minute ticket, re-checked against the reader's *current* scope on use.

Each version is immutable; a replacement document is a new version beside the old one.

## 6. Bank simulation

`BankVerifier` is a port with two implementations: the mock adapter, and an
`AuthorizedBankVerifier` that intentionally raises `NotImplementedError`.

- Eight scenarios: match, amount mismatch, maturity mismatch, not found, lien missing, timeout,
  invalid signature, replayed response.
- Every response is tagged `MOCK_BANK`, signed by the simulator's key and recorded with its
  scenario id, correlation id, evidence hash and validity window.
- `INVALID_SIGNATURE` and `REPLAYED_RESPONSE` are **rejected by the portal**: the check row records
  the rejection, a security audit event is written, and no status changes.
- `AUTHENTICATED_EXTERNAL` is unreachable; the adapter raises if a fixture ever claims it, and the
  settings gate refuses to start with the simulator enabled in a production environment.

## 7. Integrity engine

`backend/app/domains/risk/rules.yaml` is the versioned catalogue; its sha256 is stored on every
finding, so a historical decision can be read against the rules that applied then. Thirteen rules
across six classes: data discrepancy, verification required, deadline risk, missing evidence,
policy hold, duplicate candidate.

Each finding carries its rule id and version, normalised inputs, evidence references, an
explanation and a recommended next step. A composite attention level (critical / high / routine)
orders work — it never triggers an action. When evidence changes, findings are re-evaluated: one
that no longer fires is auto-resolved rather than deleted, and a disposed finding re-opens with a
reason if its evidence moves.

## 8. Release workflow

Clearances and the document checklist are instantiated at case creation from the policy version in
force, so editing `release/policy.yaml` cannot retroactively change an open case.

Final approval is refused unless **all** of: every required clearance is affirmative, every
prescribed document is on record, no hold is outstanding, scrutiny has accepted the instrument, the
case is `READY_FOR_DECISION`, the approver holds the capability, and the approver is neither the
preparing officer nor the requester. The blocking reasons are returned to the UI so the operator
sees *why*, and they are re-evaluated inside the handler — a change made while a dialog was open
stops the approval. An `Idempotency-Key` makes a repeat call return the first result.

## 9. Audit and reminders

Every state change writes an audit row in the same transaction as the mutation, with redacted
summaries and a digest chained to the previous event. `/audit-events/integrity` recomputes the
chain. This is tamper *evidence*, not immutability — a deployment additionally revokes UPDATE and
DELETE from the application role and exports signed checkpoints.

Reminders are inserted from authoritative dates with a deterministic dedupe key
(`event_type:fdr_id:maturity_date:rule_version:recipient_scope`), so repeated scans create no
duplicate notice — a test asserts this. Side effects go through the outbox after the commit.

## 10. Decisions requiring authorisation

Unchanged from the brief, and none of them are decided here:

1. Hosting, data residency, contractor controls and backup locality.
2. Identity federation — whether an AICTE-approved IdP with MFA is available.
3. The applicable Approval Process Handbook year, case types, required forms, clearance bodies and
   decision authority. The bureaus in `policy.yaml` are configurable workflow steps, not a statement
   of effective policy.
4. Any bank integration — legal agreement, channel security and technical specification.
5. Retention, legal hold, public-record obligations and redaction rights.
6. Auditor rights over personal data, document downloads and exports.
7. Security assessment and incident-reporting ownership.
