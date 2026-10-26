# KoshSetu

# AICTE Security Deposit / FDR Management Portal — Frontend Product & UI/UX Specification | SIH26265

Smart India Hackathon 2026 • Implementation Brief

26 October 2026 | Version 3.0 — Brand Identity Edition

ENGINEERING SPECIFICATION • SMART INDIA HACKATHON 2026

Government-grade security posture • Controlled financial workflows • Explicitly simulated bank verification

Status: Implementation-ready design brief (prototype; subject to AICTE and policy-owner validation)
Prepared: 26 October 2026
Companion document: Backend Architecture, Security & API Specification

Project brand: KoshSetu — Secure deposits. Traceable decisions. Independent SIH prototype; not an official AICTE logo, website or bank verification service.


# 01. Problem statement and product mandate

Problem statement ID: SIH26265
Official title: Streamline of security deposit/ FDR portal.
Issuing organization: All India Council for Technical Education (AICTE), Regulation Bureau
SIH category / theme: Software / Smart Automation
Primary users: AICTE officials and approved institutions; oversight and audit stakeholders as explicitly authorized.

Problem statement — faithful scope summary (not a verbatim reproduction). AICTE needs a secure centralized portal to maintain institution-wise security deposit and Fixed Deposit Receipt (FDR) records, including instrument references, issuer bank, principal amount, issue/maturity dates, documents, verification evidence and administrative status. The system must support submission, scrutiny, discrepancy handling, authorized bank-source verification where supported, maturity alerts, renewal/replacement records, controlled release/refund processing, dashboards, reporting, audit trails and integrations subject to approval. It must distinguish institution-entered information from independently verified bank evidence. The SIH prototype should demonstrate measurable improvements in accuracy, visibility, turnaround and tracking, without claiming production bank connectivity.

Interpretation locked for this build. The team’s bank interface is a mock verification service only. It represents the structure and possible outcomes of an authorized bank response; it is not a live bank API, financial validation or proof of authenticity. Every screen using mock data must display a persistent “SIMULATED BANK RESPONSE — DEMO” indicator. Human officer acceptance is a separate administrative decision.

Government-service priority order: (1) confidentiality, integrity, access control and evidence provenance; (2) correctness and understandable workflow; (3) accessibility and uptime; (4) speed and visual polish. The interface should look modern without behaving like a consumer fintech application that obscures evidence or approval responsibility.

Source basis: SIH 2026 official listing at https://www.sih.gov.in/sih2026PS (the official site did not permit automated retrieval during preparation); archived text for SIH26265 at https://zaidsayyed.in/tools/sih-problem-statements/sih26265 ; GIGW 3.0 at https://guidelines.india.gov.in/ ; relevant AICTE Approval Process Handbook (release procedure) at https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf. Check the current applicable handbook and authorized AICTE policy before actual deployment. No official government affiliation, integration or security certification is implied.


# 02. Executive product definition


## 2.1 One-sentence proposition

A security-first administrative workspace that lets institutions submit deposit evidence and lets authorized AICTE officials review, verify, monitor, renew/replace and process release cases with a complete, auditable history.


## 2.2 Four product outcomes

Single reliable record: every FDR has one canonical instrument record, linked document versions, verification runs, review decisions and replacement/renewal relationships.

Faster scrutiny: field extraction reduces manual transcription; an evidence-first split view exposes mismatches and facilitates official decisions.

No silent missed maturity: institution and officer views surface due dates, alerts, overdue actions and escalation ownership; alerts are deduplicated.

Accountable release: a release request exposes required artifacts, prerequisite bureau clearances, separation of duties and competent-authority authorization before any final decision.


## 2.3 Non-goals / claims forbidden in demo

Do not advertise that OCR proves authenticity, that a mock bank response constitutes real verification, or that the portal transfers/redeems funds.

Do not infer automatic release eligibility from maturity alone; applicable clearances, procedural rules and competent decisions are required.

Do not claim a generic AI “fraud score” or a 99% accuracy statistic without measured labeled evidence.

Do not persist secrets, signed PDF URLs, bearer tokens, full financial document contents or raw bank payloads in analytics/browser storage.

Do not place a conversational chatbot on the critical path. Explaining rule-derived findings is more valuable.


## 2.4 Experience principles

Evidence above decoration: show source, claimed field, verified field, timestamp, confidence and who acted.

No color-only meaning: status badges combine text + icon + color; danger and warning states must be distinguishable for color-blind users.

Progressive disclosure: dense detail lives in drawers or detail pages, but critical blockers are never hidden.

Institution scope by default: institutions view only their cases and permitted actions; officials see only explicitly assigned jurisdictions or responsibilities.

Accessible first: semantic landmarks, predictable focus, robust keyboard paths and forms usable with assistive technology.

State is explicit: asynchronous steps display queued / scanning / extracting / review-ready / failed, rather than a never-ending “AI analyzing” spinner.


# 03. User actors, permissions and major journeys


## 3.1 Roles and front-end capabilities


| Persona | Principal objective | Visible modules | Forbidden actions |
| --- | --- | --- | --- |
| Institution submitter | Submit and correct deposit evidence | Institution home, FDR registry, submission wizard, renewal/replacement, release request, notices | Cannot view other institutions or perform official verification/approval |
| Institution approver (optional) | Attest institution submission | Same as submitter plus institution attestation step | Cannot approve AICTE release |
| AICTE scrutiny officer | Validate submissions and evidence | Officer work queue, FDR detail, PDF review, discrepancy resolution, clearance review | Cannot self-approve restricted dual-control decisions |
| AICTE supervisor / competent authority | Approve controlled transitions and release decisions | Escalations, approval queue, release center, audit summary | Cannot bypass required clearances or audit requirements |
| Bureau clearance officer | Record mandated NOC / hold / clarification | Assigned clearance requests only | Cannot release funds or modify unrelated case records |
| Security/admin operator | Manage assignments, identities, operational settings | User roles, institution mappings, rule versions, system health | No blanket right to change financial evidence or sign off a business case |
| Auditor / read-only oversight | Inspect provenance and activity | Filtered reports, timelines, audit exports | No case mutation |


Design rule: UI permissions communicate what is allowed, but server-side resource-level authorization is authoritative. A hidden button is not an authorization control. The same person may have multiple roles; effective permissions depend on assignment, case scope, current state and separation-of-duties constraints.


## 3.2 Primary institution journey

Login → Institution home → New FDR → Metadata → Upload → Server processing → Extracted-field review → Attest and submit → Track scrutiny → Correct if requested → Monitor maturity → Initiate approved renewal/replacement or release request.

The upload wizard saves a draft before file upload. Closing the browser cannot silently lose a completed upload. After submission, core attested fields are not directly editable: the institution submits a correction request/new version with a reason.


## 3.3 Primary AICTE officer journey

Login + MFA → Assigned work queue → Select institution/instrument → Evidence viewer → Compare institution claims vs parsed fields vs mock verified values → Record findings → Request clarification or accept scrutiny → Monitor deadlines → Process authorized release clearance and final approval.

For simulated bank checks, the UI must show response source MOCK_BANK, scenario identifier, correlation ID and mock receipt time. Production-ready placeholders can explain where a formally authorized integration would sit, without displaying a fake “live bank verified” shield.


## 3.4 Supervisor / release journey

Assigned release queue → Check requested release basis → Inspect current record + bank status + checklist → Confirm bureau clearances and supporting documents → Confirm maker-checker separation → Approve/reject/request documents → Sign/record final action → Export audit narrative.

Clearance organizations and required documents should be configuration-driven according to the current applicable AICTE approval process and case type. For example, applicable guidance can involve PGRC, Vigilance and other bureaus; the demo treats these as configurable workflow steps rather than hardcoded universal law.


# 04. Navigation and information architecture


## 4.1 Global application shell

Desktop: fixed 240–256 px deep navy sidebar; light-gray main canvas; sticky top utility toolbar with role/institution context, search, notifications and profile. A persistent environment banner above the content indicates DEMO / SIMULATED BANK in the SIH environment. Use spacious solid white cards instead of translucent overlays for financial tables.

Compact desktop/tablet: collapse sidebar to 64–72 px with accessible tooltips or off-canvas drawer. Maintain visible page title, context and action hierarchy. Mobile: allow view/status tracking and simple messages, but complex PDF review and dual approvals can be desktop-optimized with an explicit responsive fallback rather than an unusable compressed layout.

Topbar: breadcrumbs; module name; active institution/assignment (when relevant); global quick search with authorization-aware results; notifications; help; profile/session. An environment pill reads DEMO ENVIRONMENT and a secondary pill BANK: SIMULATED. Do not display real government seals, logos or official domain claims without permission.


## 4.2 Institution navigation


| Navigation item | Route suggestion | Primary content |
| --- | --- | --- |
| Overview | /institution/overview | Institution KPIs, required actions, alerts |
| My FDRs | /institution/fdrs | Searchable instruments and lifecycle state |
| New submission | /institution/fdrs/new | Five-step wizard |
| Renewal / replacement | /institution/renewals | Linked instrument changes and required proofs |
| Release requests | /institution/releases | Create and track controlled requests |
| Documents | /institution/documents | Restricted document library and versions |
| Notifications | /institution/notifications | Deadline and action alerts |
| Activity | /institution/activity | Submissions and official actions visible to institution |
| Help | /help | Process explanations, FAQs, accessibility |



## 4.3 AICTE official navigation


| Navigation item | Route suggestion | Primary content |
| --- | --- | --- |
| Overview | /official/overview | Portfolio KPIs, due-date bands and audit warnings |
| Work queue | /official/queue | Assigned verifications and clarification tasks |
| All FDRs | /official/fdrs | Scope-filtered master register |
| Maturity center | /official/maturities | Calendar, 7/15/30/60-day action lists |
| Release center | /official/releases | Case progress, checklist, clearance matrix |
| Risk & exceptions | /official/exceptions | Rule-derived reasons, filters, evidence |
| Reports | /official/reports | Exportable summaries and reproducible date cuts |
| Audit explorer | /official/audit | Append-only event timeline, permitted scope |
| Administration | /admin/* | Separately protected, least-privilege setup |



# 05. Visual design system and tokens


## 5.1 Design language

Style: restrained enterprise/government-grade fintech. The dark sidebar provides brand anchoring; the working canvas is bright and low distraction. Glass effects are optional for hero/overview surfaces only. Compliance tables, review findings, PDFs, modals and alert content use near-opaque surfaces. Prefer strong typography, precise alignment, thin borders and moderate whitespace over excessive gradients or animation.

Typography: use Inter or an accessible sans-serif available under an appropriate deployment license; a Devanagari-capable fallback stack is required if Hindi localization is implemented. Body 14–16 px; long explanatory text 16 px; UI headings 20–28 px; numerical KPI display 28–36 px; dense financial tables at least 13–14 px with adequate line-height. Use tabular numerals for amounts and dates.


## 5.2 Tokens


| Token | Suggested value | Intent |
| --- | --- | --- |
| surface.canvas | #F6F8FB | Main application background |
| surface.primary | #FFFFFF | Cards, tables, forms and review panes |
| surface.subtle | #F0F3F8 | Inset metadata or filter areas |
| sidebar.background | #0F172A | Dark fixed left rail |
| sidebar.active | #233454 | Active destination |
| text.primary | #101828 | Financial facts and headings |
| text.secondary | #475467 | Secondary explanatory labels |
| brand.primary | #2455C5 | Links, primary actions, active controls |
| state.success | #067647 | Verified/accepted only when substantively true |
| state.warning | #B54708 | Expiring, pending clarification |
| state.danger | #B42318 | Rejected, critical unresolved discrepancy |
| border.default | #D8DEE8 | Form and table boundaries |
| radius.card | 12 px | Consistent restrained rounding |
| shadow.card | 0 1px 3px rgba(16,24,40,.08) | Separation without faux depth |
| motion.standard | 140–200 ms | Short, reduced-motion-respecting transitions |
| brand.jade | #126A5B | Primary logo accent, safe secondary highlights and branded navigation details |


Use a verified contrast checker for final combinations. The provided values are proposed design tokens, not a claim of proven WCAG compliance. Do not borrow AICTE branding beyond what the team is authorized to reproduce.


## 5.3 Components and anatomy

App shell: semantic sidebar navigation, landmark <main>, skip link, topbar and role-aware breadcrumbs.

KPI card: precise title, number, comparison context, as-of timestamp and drilldown link; avoid unlabeled large figures.

Status badge: icon + words; distinguish Submitted, Parsed, Pending bank verification, Mock verified, Accepted by officer, Maturing, Released.

Data table: TanStack Table with column labels, sorting, page size, per-column filters, selection state, keyboard focus and an explicit empty-filter reset.

Action menu: clearly scoped case actions; destructive transitions require confirmation, reason and a review of consequences.

Alert item: severity + case reference + due date + owner + “why it matters” + actionable destination.

Evidence panel: field name, entered value, extracted value, verified value (if any), source document/page, extraction status, reviewer decision.

Audit timeline: actor/role, timestamp, action and before/after summary; offer technical trace ID in expandable detail.

Form controls: persistent labels, inline help, errors linked by aria-describedby, server validation and confirmation state.


## 5.4 Responsive layout grid

Desktop at 1440 px: sidebar 248 px; main content max-width ~1440 px with 24–32 px padding; 12-column grid. At 1024 px: sidebar collapsible; 16–24 px content spacing. At 768 px and below: side navigation drawer; KPI cards stack; tables use horizontal scrolling with sticky reference column; never clip monetary amounts or action controls. Document compare view becomes tabbed rather than shrinking PDF and data into illegible columns.


# 06. Screen-by-screen specification


## 6.1 Official overview dashboard — /official/overview

Purpose: communicate portfolio health in under ten seconds, with actionable exceptions and clear data provenance. Top strip: current authorization scope, as-of timestamp, “simulated bank” banner and last data refresh. KPI row: total active principal (INR), active instrument count, maturities in 30 days, pending verification, unresolved discrepancies, outstanding release cases. Each KPI opens a saved filter view; report denominators and status definitions in tooltips.

Main grid: maturity histogram by month (amount and count toggle); verification backlog by age band (0–2, 3–7, 8–30, 30+ days); top action-needed instruments table; recent approval/clearance activity. Recommended “Next action” is rule-based, not ML fraud inference. Default view: “Assigned region” to avoid unauthorized global metrics.

Table columns: reference (masked where necessary), institution, issuing bank, principal, maturity, days remaining, institution submission status, bank check status, officer review status, risk reasons, assigned official, last activity. Sticky identifier column and stable sort order. Provide filters for region, status, maturity band, bank, amount band and owner.

States: initial skeleton, successful data load, zero instruments, no matches, stale feed, partial export failure and read-only maintenance. Server pagination / backend aggregation; never fetch all deposits to client merely to compute KPIs.


## 6.2 Institution overview — /institution/overview

Show only the authenticated institution. Hero summary shows submitted instruments, active amount, requests awaiting official action and next relevant deadline. “Action required” cards take priority over vanity totals: correct missing affidavit, respond to mismatch, replace uploaded unreadable PDF or complete release documents. Progress labels distinguish “We received your file” vs “Officer approved it.” Include a compact timeline of institution-visible events, with nonpublic official notes hidden.


## 6.3 Master FDR register — /official/fdrs and /institution/fdrs

Search: ID, masked FDR number, institution/AICTE ID, bank, case reference; debounced input, allow exact identifier search and filters; do not query raw bank credentials. Data affordances: view detail, download authorized export, save filter (optional), row context menu. A filter chip bar explains currently applied scope. Rows should never expose full signed S3 URLs. Exports: user requests export; backend checks scope again; UI receives expiring download link to redacted or permitted CSV. Log who exported and why if policy requires it.

Row detail summary: dates, principal, permitted last-four FDR identifier, current version, last parsed PDF, most recent bank verification outcome, regulatory review outcome, next scheduled alert. Do not conflate “verified by bank” with “accepted by AICTE.”


## 6.4 Institution submission wizard — /institution/fdrs/new

Step 1 / Identity: institution displayed from authenticated claim, not editable; select category or process, issuer bank, branch and IFSC (validated format, bank identity only if registry available). Step 2 / Instrument metadata: FDR number (mask/reveal), amount (INR, precise decimals), issue date, maturity date, interest rate if applicable, lien beneficiary/status, optional reference metadata. Step 3 / Upload: only allow approved formats (e.g., PDF), show max size from API, upload consent and redaction guidance; show checksum/size preview; clear error for unsupported files. Step 4 / Parse and compare: UPLOADED → SCANNING → EXTRACTING → READY_FOR_CONFIRMATION; highlight each extracted field and its page coordinate, show Not found rather than fabricate a value, allow institution corrections with reason. Step 5 / Review and attest: summarize values and document version; institution attests accuracy; submit once using idempotency key.

Example mismatch: Entered principal ₹25,00,000 vs document extraction ₹20,00,000. Highlight both numbers, document page, confidence and action “correct entry / request manual review.” Red shading is not proof of fraud. Ambiguous extraction requires clarification, not automatic rejection. Save drafts at appropriate boundaries; handle refresh and retries using upload session ID.

Upload safety UX: never inline-render unscanned files; quarantine wait state; explicit error for scan failure vs extraction failure; accessible progress percentage; support cancel-before-finalization; hide direct object-storage URLs from user-facing copy. File-level errors should not erase completed metadata.


## 6.5 FDR detail and evidence review — /official/fdrs/:id

Header: case reference, lifecycle, separate verification badges, priority reason and permitted actions. Split view desktop: left 54–58% PDF.js viewport with page toolbar, zoom, thumbnails and search; right 42–46% tabbed data panel (Fields, Checks, History, Notes). Each field lists submitted value, extracted value, verification source and difference class. Clicking a field jumps to the referenced page and temporarily highlights the bounding box. For unextractable PDFs, allow officer manual review with a documented reason.

Discrepancy categories: missing value, OCR uncertainty, institution-vs-document mismatch, bank-vs-document mismatch (when a response exists), identity conflict, duplicate-candidate, stale supporting document. Separate data quality from external authenticity status. The mock response tab prominently identifies its artificial source and scenario.

Actions: Request clarification, Record observation, Re-run parsing (authorized), Start bank simulation (demo role only), Accept scrutiny, Escalate, Reject with reason. Critical actions open a confirmation dialog showing case/version, impact, prerequisites and mandatory notes. “Override” is renamed “Record justified exception” and must capture a reason, approval right and audit event.

Conflict handling: if another official modifies the case, show conflict banner and re-fetch; do not silently override a more recent decision. Display last updated by and record version. Unauthorized and stale signed download responses should become safe messages, not infinite spinners.


## 6.6 Maturity & renewal center — /official/maturities

Offer a monthly calendar and compact table alternatives. Filters: due within 7/15/30/60/90 days, matured, overdue action, linked replacements, outstanding institution response. A date is not itself a release approval or mandatory renewal. Display the next action according to a versioned rule set and actual case type. Show institution’s currently linked predecessor/successor instruments and evidence of replacement. For an automatic renewal reported by bank, mark it as a claim or simulated evidence until verified.

A “Renewal/replacement” submission creates a linked instrument or version per policy, never overwrites the prior instrument’s historical evidence. Show predecessor ID, successor ID, requested reason and effective date. Warn on overlapping validity or conflicting identities without automatically treating them as fraud.


## 6.7 Release/refund center — /official/releases

Table: request ID, institution, FDR, request date, case basis, current checklist status, pending clearance, reviewer, approving authority and due action. Case detail: application letter, affidavit, FDR copy, relevant LoA/EoA, additional proofs where prescribed; configurable PGRC/Vigilance/other bureau clearances; hold conditions; maker-checker review; decision document or NOC/sanction references where applicable. The platform records administrative status rather than moving money.

Guardrails: cannot finalize without configured prerequisites; negative clearance opens a HOLD state; officer who prepared a restricted action cannot be its sole final approver. “Request more info” retains case history. Every clearance has issuer, timestamp, validity, document/provenance reference and recorded official identity. Clearly separate REQUEST_APPROVED from BANK_RELEASE_COMPLETED, which may not be known to the platform.


## 6.8 FDR integrity & action-needed center — /official/exceptions

This is the differentiating feature. No opaque fraud score. Show a deterministic, explainable list of findings grouped by Data discrepancy, Verification required, Deadline risk, Missing evidence, Policy hold and Duplicate candidate. An optional composite attention level (Critical / High / Routine) is derived from a documented rule table, not a trained predictor.

Example case: maturity in 12 days, submitted amount differs from PDF, bank simulation pending. Findings list each rule identifier, severity, source timestamps, assigned owner, suggested next step, expiry of result and officer disposition. Ranking is for work priority, not declaration of fraud or financial culpability. Users can filter findings, see “why flagged”, mark false positive with reason and reopen if evidence changes.


## 6.9 Audit explorer and reports — /official/audit, /official/reports

Audit explorer: search by case, actor ID, date range, event type, source system and correlation ID, subject to permissions. Read-only event detail shows prior/next state, evidence version, intent, reason, approval chain, IP/device risk metadata only where privacy policy permits. Do not expose authentication tokens or full financial data in event descriptions. Reports: active exposures by status, upcoming maturities, verification turnaround, clearance backlog, unresolved mismatches and export history. Every export displays scope, generation timestamp and a report run ID.


## 6.10 Notifications and system state

Notifications are categorized Action required, Information, Security, Deadline. Each has an accessible label, timestamp, FDR reference, due date and action destination. The inbox and alert badge show unread counts, but a user can still find reminders after marking them read. Delivery may be in-app and email; SMS is out of scope unless explicitly approved. Global session-expired modal clearly preserves unsaved work where possible, then routes to login. Maintenance and permission-revoked states are first-class UX states.


# 07. Content style, status vocabulary and microcopy


## 7.1 Precise labels


| Avoid | Prefer | Reason |
| --- | --- | --- |
| “AI verified” | “Fields extracted from document” | Parsing does not authenticate issuer |
| “Bank verified” on mock check | “Mock bank check passed — simulation” | Explicit provenance |
| “Fraud detected” | “Discrepancy requires review” | Evidence is not adjudication |
| “Approve Override” | “Record justified exception” | Improves accountability |
| “Refund complete” | “Release request approved” | Approval is not fund movement |
| “Renewal successful” | “Replacement submitted / accepted” | Evidence and state distinction |
| “Ready” | “Ready for officer review” | Defines ownership of next step |



## 7.2 Sample error and help copy

Invalid upload: “This file could not be accepted. Upload a PDF up to the allowed size; your entered details were saved.”

Scan pending: “The file is uploaded. Security scanning is still running. Do not submit until the file is cleared.”

OCR low confidence: “We could not read the maturity date reliably. Compare with the highlighted document and enter the correct value.”

Mock response: “Demonstration only: this simulated bank response is not independent authentication.”

Authorization denied: “You do not have permission to view or change this record. Contact your organization administrator.”

Stale version: “This case changed since you opened it. Review the latest version before taking action.”

Release hold: “The request cannot proceed until all currently required clearances and conditions are satisfied.”


# 08. Accessibility, localization and inclusion

Policy alignment: use GIGW 3.0 as a government-context benchmark; GIGW identifies WCAG 2.1 AA and cybersecurity/accessibility expectations. Target WCAG 2.2 AA where feasible as an additional project goal, without falsely claiming external certification. The actual production conformity assessment belongs to the competent owners/auditors.

All navigation, dialogs, file uploads, PDF toolbar controls, tabs and table actions work with a keyboard. Never require drag and drop; provide a standard file input.

Keep visible focus outlines, minimum usable hit targets and reduced-motion support. Auto-advancing animations must not steal focus.

Use semantic HTML form labels, ARIA live regions for asynchronous upload/check status, landmarks and skip-to-content. Modal focus is trapped only while the modal is open and returns to its trigger.

Charts have nearby numerical summaries and accessible data tables; never use chart color alone to encode maturity status.

Currency uses ₹ and clear INR context; amounts in Indian grouping (₹25,00,000.00), with unambiguous stored decimal semantics. Dates displayed as 26 Oct 2026 to avoid DD/MM ambiguity; API remains ISO 8601.

English is the initial MVP language. Prepare translation keys and layout for Hindi or other officially approved languages, but do not ship unreviewed machine translations as authoritative compliance instructions.

PDF embedded documents may not be accessible; all critical extracted facts and decision controls must also exist as accessible HTML text.


# 09. Frontend security and privacy contract

The browser is an untrusted environment. Never put institution-wide records, bank mock signing secrets or approval entitlements into frontend-only logic. Role gates are convenience; every API request is independently checked server-side. Do not expose real record IDs across tenants if the current principal is unauthorized, even if the ID is guessed.

Sessions: secure HttpOnly cookies and CSRF protection for cookie-authenticated writes, or a similarly reviewed deployment model. Avoid storing access/refresh tokens in localStorage or sessionStorage. Coordinate exact flow with backend.

CSP: tight script/style/connect/frame sources; no unsafe HTML, sanitization for institution-supplied comments, and PDF.js configured against untrusted content. No inline arbitrary scripts or third-party analytics on restricted documents.

Cache control: Cache-Control: no-store for sensitive pages/API responses. Service workers must not cache FDR PDFs, auth responses or personal financial data. Clear client query cache on logout or institution-context change.

File access: display PDFs only through a short-lived authorized download flow; do not embed perpetual S3 URLs. Re-authorize on reload; revoke/restrict after role changes.

Download/export: display data-classification context, mask where policy requires, remind users exported copies are sensitive and never leak them to client error trackers.

Error reporting: redact names, FDR numbers, documents, tokens, authorization headers and bank payloads. UI error IDs map to backend correlation IDs.

Approval guardrails: require step-up authentication where policy mandates; show checker identity distinct from maker; display immutable action receipt generated server-side.

Idle timeout: warn before expiry (if supported); expiry always enforced server-side, not by a cosmetic client timer.


# 10. Frontend architecture and integration contracts


## 10.1 Recommended stack

Next.js (App Router), TypeScript strict mode, Tailwind CSS, shadcn/ui/Radix primitives, TanStack Query, TanStack Table, React Hook Form + Zod, PDF.js/react-pdf, Recharts, Lucide icons. SSR/route layouts may improve perceived navigation speed, but confidential business data should be fetched only through authenticated, authorization-checked calls with safe caching settings. Avoid introducing a custom design system until repeated requirements justify it.


## 10.2 Suggested source structure

src/
  app/(public)/login/                 # Authentication shell
  app/(secure)/institution/           # Institution workspace
  app/(secure)/official/              # Officer workspace
  app/(secure)/admin/                 # Separate access policy
  components/app-shell/               # Sidebar, topbar, breadcrumbs
  components/fdr/                     # Instrument details, dates, badges
  components/document-review/         # PDF viewport, evidence mappings
  components/release/                  # Clearance matrix, approval UI
  components/notifications/
  components/ui/                       # Common accessible primitives
  features/fdr/api/                    # Typed client and DTO mapping
  features/fdr/hooks/                  # Queries and mutations
  features/permissions/                # Presentation-level gate helpers
  lib/auth/                            # Session bridge (not auth authority)
  lib/api/                             # Client, errors, correlation IDs
  lib/format/                          # INR, dates, statuses
  test/                                 # Component and browser tests


## 10.3 Consistent response/error envelope

{
  "data": {"id": "uuid", "version": 7, "lifecycle_status": "ACTIVE"},
  "meta": {"request_id": "req_...", "as_of": "2026-10-26T11:00:00Z"}
}

{
  "error": {
    "code": "CASE_VERSION_CONFLICT",
    "message": "This record was updated by another authorized user.",
    "request_id": "req_...",
    "field_errors": {}
  }
}

Status model in UI: lifecycle_status, verification_status, officer_review_status, lien_status, release_request_status are independent. A single universal “FDR status” badge would erase key financial/control distinctions.


## 10.4 Async operations and revalidation

Uploads receive an upload session ID and use presigned object transfer. UI polls a safe processing endpoint every 2–4 seconds while active, with exponential backoff; WebSockets are a later enhancement, not a dependency for correctness. After a mutation, invalidate exact query keys; use optimistic updates only for reversible UI preferences—not authoritative approvals, financial status or clearance outcomes. Protect form submits against doubles, but depend on backend idempotency for true safety.


# 11. Component and route acceptance criteria


| Requirement | Observable acceptance criteria | Priority |
| --- | --- | --- |
| Authenticated shell | Correct role-specific navigation; no authorized data flashes before auth check | P0 |
| Institution scoping | Cross-institution URL access returns safe denied state; no data shown | P0 |
| Submission wizard | Draft, upload, process, confirm and submit survive refresh/retry safely | P0 |
| Mock provenance | Every simulated bank result visibly marked and traceable | P0 |
| Evidence review | Reviewer sees entered/extracted/mock fields separately, with source pages | P0 |
| Approval actions | Unauthorized buttons absent; backend denial also handled correctly | P0 |
| Maturity notifications | 30-day and overdue demo cases appear with next action and owner | P0 |
| Renewal/replacement | Predecessor and successor documents remain inspectable | P0 |
| Release guard | Incomplete clearances block approval with clear reason | P0 |
| Audit timeline | Every action shows actor, timestamp, type, reason and correlation | P0 |
| Keyboard accessibility | Main journeys navigable without mouse; focus visible | P0 |
| Reports | Search, pagination and authorized CSV export work end-to-end | P1 |
| Hindi localization | Architecturally ready, translated after review | P2 |
| WebSocket push | Optional progressive enhancement | P2 |



# 12. Visual QA and usability test matrix

Test viewport matrix: 1440×900, 1280×800, 1024×768, 768×1024 and 390×844. Test 200% browser zoom, long institution names, unknown bank names, missing PDF text and 100+ table rows. Test Chrome, Edge and Firefox current major versions; Safari where available. Check dark sidebar contrast, tooltip keyboard access, sticky overlays and legal/official wording.

Five usability scenarios: (1) first-time user submits readable FDR; (2) malformed PDF is rejected without losing draft; (3) principal mismatch flows to clarification; (4) official finds a deposit maturing in 12 days and identifies owner; (5) release cannot finalize while an assigned bureau clearance is pending. Record task completion, serious errors, time to required action and user confusion. Avoid invented before/after improvement statistics; measure demo baseline and report the observation conditions.

Security-focused browser tests: expired session during upload, role removed while detail page open, pasted unauthorized case ID, malicious filename, PDF with embedded link, cross-site form submission attempt, rapid double click on approval, stale record version and downloadable export after role revocation.


# 13. Implementation sequence and deliverables

Phase A — foundations (P0): design tokens, app shell, auth layouts, role-scoped nav, table primitives, status labels, typed API client, standardized errors and accessible form system. Exit: empty-state dashboards work from real API calls, unauthorized routes do not leak data.

Phase B — core workflow (P0): institution registry, FDR list/detail, wizard upload, processing status, PDF viewer and evidence panel. Exit: a real record travels from new draft to officer review without fake UI actions.

Phase C — trust workflows (P0): separate mock bank provenance, officer scrutiny, reasons and audit views, deadline alert inbox, renewal link and blocked release matrix. Exit: all negative/hold branches function.

Phase D — differentiator & polish (P1): risk/exceptions view, provenance-aware recommendations, reports, animations, responsive QA and keyboard/screen reader tests. Exit: cohesive 5–7 minute SIH demo based on seeded cases and clearly disclosed limitations.

Frontend deliverables: route map; screen inventory; design tokens; component library; typed API DTOs; reusable form validation; page states; accessibility checklist; route-level integration tests; e2e demo test fixtures; realistic but synthetic data; README and screenshots.


# 14. SIH demonstration script (screen-by-screen)

Official overview: show pending verification and maturing instruments; explain mock bank badge.

Institution wizard: upload a synthetic sample FDR and track scan/OCR job states; confirm fields.

Mismatch: alter institution-entered amount; demonstrate highlighted PDF region and discrepancy queue.

Bank simulation: trigger signed simulated response; show separate “mock check passed” and officer decision states.

Maturity center: load an instrument due in 12 days; explain action-needed rule and existing notification.

Replacement: associate a replacement FDR without deleting the previous record.

Release: attempt approval with missing clearance (blocked), supply configured clearance, and complete maker-checker approval as separate authorized users.

Audit/report: show append-only history, actor attribution, timestamps and export scope.

Demo data disclaimer: all institutions, instruments, signatures, clearance records and bank API results used in the demonstration are synthetic. The portal does not connect to bank or AICTE production systems.


# 15. Frontend risk register and open policy decisions


| Risk / decision | Mitigation / required owner |
| --- | --- |
| Impersonating an official AICTE website | Demo branding disclaimer and non-official domain; approval required for government marks |
| Misinterpreting bank simulation as actual verification | Persistent simulation badge on every relevant view and export |
| Incorrect rules for renewal/release | Versioned rule configuration reviewed against applicable APH by AICTE owner |
| Missing jurisdiction filters | Resource-scoped API responses and front-end role views; denial tests |
| Unusable PDF review on narrow screens | Desktop-first split view; accessible tabbed mobile fallback |
| Document exfiltration via analytics/error telemetry | Redaction, CSP, secure viewers, no third-party capture |
| Government accessibility gaps | GIGW 3.0 and WCAG test plan; independent audit before real deployment |
| Undefined retention and export policy | Institution/regulator policy sign-off before actual production storage |



# 16. Illustrated frontend examples: seven authoritative demo layouts

The following images are original schematic UI examples created specifically for this project, not screenshots of a live AICTE system. All amounts, institutions, case references and dates are synthetic. They intentionally retain the dark navy navigation rail, airy off-white canvas, high-contrast solid content surfaces and conservative glass-like highlights. They are design targets, not pixel-perfect production specifications.


## 16.1 Official overview dashboard — visual example

Official dashboard concept: active principal, maturing deposits, work queue, maturity chart and FDR table.

Functional mapping: KPI Active principal uses only appropriate eligible/accepted instruments; Expiring in 30 days is calculated from dates, not a persisted instrument status; Awaiting review comes from review queue assignments. The chart has a tabular equivalent and supports month-range filters. A case row opens its authorized detail, never a publicly accessible PDF URL. Original example retained: three glass-like metric cards, month-wise maturity bar chart, searchable/paginated register, status/region/bank filters and high-priority action queue.

Data-state requirements: loading = skeleton, empty = zero matching FDRs with filter reset, error = no retained stale sensitive metrics, permission-limited = omit unauthorized aggregates. The frontend must never recompute authoritative sums from incomplete paginated rows.


## 16.2 Institution upload wizard — visual example

Institution FDR upload wizard showing the four steps, security-scanned PDF zone and OCR field confirmation.

Functional mapping: Step 1 choose or prefill institution and FDR metadata; Step 2 upload via presigned endpoint; Step 3 display explicit states PENDING_UPLOAD, SCANNING, EXTRACTING, READY_FOR_CONFIRMATION, MANUAL_REVIEW_REQUIRED, FAILED; Step 4 confirm and attest. Provide an ordinary file chooser alongside drag-drop. A PDF is displayed only after a clean scan result. An institution correction captures original OCR value, confirmed value, correction reason, user and timestamp.

Original motion retained: progress bar while transferring; a separate indeterminate processing indicator if job progress is unknown; field cards reveal only when OCR is complete; reduced-motion users see immediate visibility changes. Avoid a fake progress percentage generated from a timer.


## 16.3 Discrepancy review — split-screen example

Evidence workbench concept: PDF source highlight on the left and separate input/extraction/verification readings on the right.

Functional mapping: left 55% PDF viewer with page navigation and evidence highlight; right 45% extracted fields and officer actions. The original example of ₹25,00,000 (institution input) versus ₹20,00,000 (document extraction) is intentionally maintained. Clicking a field highlights the exact page and bounding box. A red mismatch describes an inconsistency, not confirmed forgery. Buttons are Request clarification, Record observation, Accept scrutiny when authorized, and Record justified exception for specially authorized policies (no unrestricted “Approve Override”).

Verification naming: four clearly separate badges: Submitted claim, OCR extracted, Mock bank check, and AICTE scrutiny decision. A mock passed response never upgrades the UI to Bank authenticated.


## 16.4 Maturity and renewal — visual example

Maturity queue with threshold cards, deadlines and predecessor-to-successor renewal chain.

Functional mapping: 7/30/60/90-day selectors; computed days_remaining; overdue action tracking; renewal request state; linked predecessor and replacement; reminder history with unique delivery-event keys. Instrument maturity does not imply bank redemption, release approval or refund completion. Highlight actions, not just dates.


## 16.5 Release and clearance — visual example

Release approval center with configured bureau clearances and blocked maker-checker final approval.

Functional mapping: configurable required clearances and evidence checklist, each with issuing authority, timestamp, provenance and reason. The example deliberately BLOCKS release approval while Vigilance clearance remains pending. Prepare, Review and Final approve are separated according to applicable policy and assigned permissions. The UI distinguishes Release request approved from actual funds having been released by a bank.


## 16.6 Integrity and action-needed engine — visual example

Explainable integrity queue with mismatches, maturity risk, duplicate candidates and recommended officer actions.

Functional mapping: each finding shows deterministic rule ID, case, severity, provenance, suggested next action, reviewer, disposition and recheck timestamp. Present three classes distinctly: document mismatch, timing issue and verification/evidence issue. No opaque fraud score. Risk display cannot hide the underlying evidence or substitute for the officer’s decision.


## 16.7 Audit timeline — visual example

Read-only audit chronology with actor identity, timestamps and transaction correlation IDs.

Functional mapping: chronological events with who/what/when/why, immutable evidence version, source system and request correlation. Authorized audit export includes watermark/report ID/scope and never bearer credentials or unredacted sensitive values by default. Read-only auditors must not be offered mutation controls.

Also included other UI directions


# 17. Precise component-level frontend examples


## 17.1 Approved palette, hierarchy and density


| Element | Example visual rule | Important implementation detail |
| --- | --- | --- |
| Sidebar | #111C32, solid navy, white active label | 256px desktop, overlay/drawer on small screens, keyboard focus |
| Canvas | #F5F7FB | No busy gradients behind financial data |
| Primary card | #FFFFFF, fine slate border | Prefer opaque data surfaces to blur over text |
| Optional glass accent | bg-white/80 backdrop-blur-sm | Only decorative summary panels, never critical PDF evidence |
| Main text | #17243B | Target 4.5:1 contrast for normal text |
| Secondary text | #65758B | Verify exact contrast at rendered size |
| Action blue | #1D64C7 | Visible focus and hover/pressed state |
| Verified/accepted | Green with label and icon | Mock bank outcome must not use same wording as actual verification |
| Attention | Amber with explicit due date | Do not rely on color alone |
| Discrepancy | Red with detailed explanation | Do not label it fraudulent by default |
| Tables | 48–56px rows, sticky headers, 14–16px labels | Stable alignment, accessible sorting, server-side pagination |


Typography: Inter for Latin-script dashboards (with a licensed/system fallback), support appropriate Devanagari fonts for Hindi in later localization. Do not ship the font files in this brief. Use 16px body when space allows, 20–24px main card titles and 28–32px page headings; use tabular numerals for money, counters and dates where available. Financial fields are right aligned in tables.


## 17.2 Example application shell and primary navigation

// app/(portal)/layout.tsx - example composition, not auth middleware
import type { ReactNode } from "react";

export default function PortalLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F7FB] lg:grid
                    lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="bg-[#111C32] text-white" aria-label="Portal">
        {/* Navigation is generated from server-authorized capabilities. */}
        <nav aria-label="Primary navigation">...</nav>
      </aside>
      <div className="min-w-0">
        <div role="status" className="bg-amber-50 px-4 py-2
                                  text-amber-900">
          DEMO ONLY - simulated bank verification
        </div>
        <header>{/* Context, actions and account menu */}</header>
        <main id="main-content" className="p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

Security caveat: this example illustrates composition only; fetching assigned permissions and validating each request occurs in trusted server code and FastAPI. Hiding a link is not access control. In Next.js App Router, do not inadvertently cache user-scoped financial responses across sessions. Favor a backend-for-frontend (BFF) session design with server-held credentials where deployment constraints permit.


## 17.3 Example accessible status label

type CheckState = "NOT_RUN" | "PENDING" | "PASSED" | "FAILED";

const words: Record<CheckState, string> = {
  NOT_RUN: "Bank simulation not run",
  PENDING: "Mock bank simulation pending",
  PASSED: "Mock bank check passed - simulation",
  FAILED: "Mock bank check failed - simulation",
};

export function MockCheckBadge({ state }: { state: CheckState }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md
                     border bg-amber-50 px-3 py-1 text-amber-950">
      <span aria-hidden="true">SIM</span>
      <span>{words[state]}</span>
    </span>
  );
}

This badge must remain visually distinct from AICTE scrutiny accepted. Long labels may wrap; do not truncate the simulation disclaimer. Use icons with accessible text rather than emoji-only indicators.


## 17.4 PDF evidence interaction contract

Select field "principal_amount" in review panel
  -> map `document_id`, `page_index`, `bbox` to PDF viewer
  -> verify currently authorized document/version
  -> jump to page (0-based from API; convert if UI is 1-based)
  -> highlight bounding box using page viewport coordinates
  -> announce "Amount found on page 1" via aria-live
  -> show original, normalized and officer-entered values
  -> always allow manual navigation if bbox is missing

PDF rendering must be isolated from unsafe embedded scripts; use a trusted PDF.js version, a restrictive content security policy, an authorized authenticated document proxy or very short-lived signed read URL and no third-party document analytics. Recheck permission when users open historical versions.


## 17.5 Dashboard, tables and input examples from initial concept

KPI cards: Total Active Deposits (₹), Expiring in 30 Days, and Pending Verifications, retaining the original amber/rose callouts. Add counts with clear inclusion criteria (e.g. accepted deposits only) and a last calculated timestamp.

Charts: Recharts maturity bar chart; month click applies filter to register. Provide a text summary of peak months and an exportable accessible data table.

Global search/filter: search references and institution names; filter by state, bank and region; debounce input, keep filters in URL, and enforce query limits and scope on server.

Wizard progress: native upload percentage if available; queue/scan/OCR steps use real server task states. Transition Analyzing with AI to Extracting document fields for more accurate wording.

Split comparison: submitted vs OCR vs mock bank response columns; red underline or border is paired with Value differs text; review actions fixed to a bottom bar only if they do not hide content at 200% zoom.

Notifications: action-required alerts use accessible timestamps and direct links; notification bells are not the only way to find escalations.


## 17.6 Responsive behavior and accessibility acceptance


| Viewport / mode | Expected behavior |
| --- | --- |
| Wide laptop (1440x900) | Fixed navigation + full tables and split PDF review |
| Medium (1024x768) | Narrow sidebar or collapsible navigation; PDF 50/50 remains usable |
| Tablet portrait (768x1024) | Drawer navigation; reviewer switches PDF and fields via tabs |
| Mobile (390x844) | No two-column PDF; stacked fields, accessible document open action |
| 200% browser zoom | No clipped sticky footer, all labels and critical actions reachable |
| Reduced motion | No animated auto-expansion required to access fields |
| Keyboard only | Skip link, table actions, zoom, review reasons, dialogs and download |
| Screen reader | Navigation landmarks, errors, step progress and audit changes announced |



# 18. Current technical recommendations and authoritative frontend links

Current-docs check (26 October 2026): Next.js official documentation and 16.3 release coverage were reviewed; prefer the latest stable, patched 16.x compatible with your Node runtime unless a subsequent stable major is confirmed in the package registry at implementation time. Tailwind CSS 4 uses CSS-first design tokens; shadcn/ui documents Tailwind 4 + React 19 integration. TanStack Table’s /latest documentation currently describes v9, so do not copy older v8 useReactTable examples into a v9 project without checking its migration guide. Pin exact supported versions in lockfiles; latest URLs are not reproducible dependency pins.

Next.js App Router: https://nextjs.org/docs/app

Next.js App Router data security: https://nextjs.org/docs/app/guides/data-security

Next.js Server/Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components

Next.js 16.3 release: https://nextjs.org/blog/next-16-3

Tailwind design tokens: https://tailwindcss.com/docs/theme/

shadcn/ui and Tailwind 4: https://ui.shadcn.com/docs/tailwind-v4

TanStack Table current docs and migration: https://tanstack.com/table/latest/docs/overview

React Hook Form: https://react-hook-form.com/get-started

Zod schema validation: https://zod.dev/

PDF.js: https://mozilla.github.io/pdf.js/

Recharts: https://recharts.org/

WCAG 2.2 Recommendation: https://www.w3.org/TR/WCAG22/

GIGW 3.0: https://guidelines.india.gov.in/

OWASP ASVS 5.0: https://asvs.owasp.org/

Verification note: a link to an official project does not imply a particular commit or library patch level was verified. Resolve and pin versions, run security advisory checks and test framework compatibility before implementation. Government deployment must also pass formal owner/security review rather than treating a hackathon document as certification.


# 19. Original references and traceability notes

SIH 2026 official problem statements: https://www.sih.gov.in/sih2026PS — primary canonical listing.

SIH26265 reproduced statement: https://zaidsayyed.in/tools/sih-problem-statements/sih26265 — accessible secondary copy checked 26 October 2026.

Guidelines for Indian Government Websites and Apps (GIGW 3.0): https://guidelines.india.gov.in/ — official government resource on UX, accessibility and cybersecurity.

AICTE Approval Process Handbook (2024–27 PDF): https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf — relevant release procedures, subject to policy/version confirmation.

OWASP ASVS 5.0: https://asvs.owasp.org/ — technical security verification benchmark to coordinate with backend team.

Revision discipline: UI status labels, permission matrix, required supporting documents and clearance rules must be jointly reviewed with the backend specification before implementation. Where this proposal differs from the current official regulations or authorized AICTE process, the approved policy and official source govern.


# 20. KoshSetu — Original Brand Identity and Visual References

Product identity. KoshSetu is the working project name for SIH26265. “Kosh” evokes funds or treasury; “Setu” evokes a bridge. Together, they describe the controlled connection between institution submissions, bank-source evidence and AICTE decision workflows. The identity is intentionally separate from official government marks.

Brand proposition. Secure deposits. Traceable decisions. The visual identity emphasizes documented evidence and review accountability rather than fast money movement, automated approval or unsupported fraud detection.


## 20.1 Supplied visual references — comparison and decisions

The three reference marks are design inspiration only. They are shown here as supplied and are not used as the project logo. The chosen identity is a new, independently drawn visual concept.


|  |  |  |
| --- | --- | --- |
| Reference A: intricate black radial motif | Reference B: simple jade-green petal ring | Reference C: dark/navy radial spiral |


A — elaborate radial ornament: The high-contrast radial rhythm is balanced and ceremonial. At small icon sizes the fine spokes lose clarity; as a government-facing symbol its wheel-like structure could also be confused with an official insignia. Borrow only its disciplined centering and consistent geometry; do not reuse the wheel or its black petal silhouettes.

B — simplified green circular mark: This has the strongest small-scale legibility and institutional calm. Its negative space, evenly weighted outer border and green tone are valuable references. However, a near-identical ring of petals would be generic and could resemble a government seal. Borrow the reduced detail and controlled geometry, not the petal arrangement.

C — navy swirling radial mark: The spiral conveys continuous monitoring, renewal and movement. Its dynamism fits an abstract technology brand but could be mistaken for an animated progress spinner, and the twisting spokes distract from accountability. Borrow its continuity narrative, but express that narrative through discrete lifecycle checkpoints.


## 20.2 Selected concept — KoshSetu original logo

Chosen direction: A modular, segmented circle surrounding a document and review shield. The ring represents FDR events across their lifecycle; distinct outer checkpoints represent institution submission, verification evidence, officer scrutiny and audit history. The document icon represents the underlying FDR record; the shield/check symbolizes controlled review, not actual bank authentication.

Original brand concept: primary mark, horizontal wordmark, dark-sidebar lockup, monochrome and compact app-icon treatment.


## 20.3 Logo versions and placement rules

Primary lockup. Use the horizontal navy/jade wordmark on white or off-white documents and public-facing pages. Keep the tagline below it where space allows; do not embed claims of AICTE endorsement.

Dark lockup. Use white lettering with the jade accent on the #0F172A sidebar or equivalent dark shell, keeping contrast high. The mark should not compete with the persistent DEMO ENVIRONMENT / BANK: SIMULATED disclosure.

Compact icon. Use the emblem for avatar/favicon/app-launcher contexts at 48 px and above. At 24 px or below, validate a simplified production icon separately: the fine inner document/check strokes may blur when rasterized.

Official-use boundaries. The identity must not incorporate the Ashoka Chakra, Government of India emblem, AICTE seal, government wordmarks or an official domain unless separately authorized. The project name has not undergone a formal trademark or domain-availability clearance.


|  |  |
| --- | --- |
| Light content: default horizontal mark | Dark sidebar: reversed horizontal mark |



## 20.4 Application mapping and implementation handoff


| Touchpoint | Implementation requirement |
| --- | --- |
| App shell sidebar | Replace the current “AICTE / FDR” placeholder with the KoshSetu dark lockup at top; retain a clear official-process subtitle such as “FDR lifecycle management.” |
| Login and institution welcome | Display the KoshSetu brand and the explanatory phrase “Security Deposit / FDR Management Portal”; include a visible Independent SIH prototype label. |
| Dashboard and report exports | Use small emblem + KoshSetu at left, and formal product module title at right; expose SIH26265 in the footer or About screen. |
| Verification and risk screens | Keep badges provenance-specific. A checkmark inside the brand icon must never substitute for “Bank verified”; always show Mock bank check passed — simulation explicitly. |
| Typography and palette | Navy #0F172A, Jade #126A5B, Trust Blue #2455C5, Canvas #F6F8FB, White #FFFFFF; reserve semantic green #067647 for genuinely positive task states. |
| Accessibility and scaling | Use descriptive alt text in documents, accessible name KoshSetu on logo links, sufficient contrast, high-DPI export and a simplified favicon candidate tested at 16/24/32px. |
| Engineering asset sources | Supplied PNG brand assets are concept images for the prototype. For production, redraw and optically tune the selected mark in vector form, then create a clean SVG/favicon package and audit licensing. |



## 20.5 Suggested naming treatments and mandatory disclaimer

Primary app name: KoshSetu

Formal descriptor: Security Deposit / FDR Management Portal

SIH context line: Smart India Hackathon 2026 • Problem Statement SIH26265

Product tagline: Secure deposits. Traceable decisions.

Mandatory notice: Independent prototype. Mock bank responses are synthetic and do not authenticate a financial instrument.
