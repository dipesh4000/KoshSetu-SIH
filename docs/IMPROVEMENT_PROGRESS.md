# Improvement progress

This is the implementation status for the improvement plan. It is deliberately
honest about integrations that require institutional approval.

## Delivered

- Dense expandable review tables, freshness indicators, and a dark,
  independently scrollable sidebar.
- Code-split React routes, bulk CSV/XLSX preview and atomic commit, turnaround
  analytics, audit export, and PDF signature inspection.
- PyMuPDF extraction with page/span bounding boxes, conflict detection,
  maturity checks, optional Hindi OCR, and explicit human-review gates.
- Persistent login throttling, session revocation/fingerprint binding,
  AES-GCM identifier storage with key rotation, fail-closed scopes,
  replay receipts, database-backed locks, and tamper-evident audit chains.
- Alembic migrations, local Postgres/MinIO Compose setup, local-only object
  storage restrictions, CI test matrices, dependency auditing, and secret
  scanning configuration.
- Reproducible synthetic extraction evaluation with Wilson intervals and
  reliability data (not a human calibration study).

## Validation

The local SQLite suite passes (91 passed, 2 intentional PostgreSQL skips).
The PostgreSQL concurrency suite is enabled in CI when
`KOSHSETU_TEST_DATABASE_URL` points at the service matrix. Frontend lint/build
and npm audit pass locally. Run the commands in `docs/DEPLOYMENT.md` before a
release.

## Deferred by approval boundary

- Firebase Cloud Messaging is architecture-only; no project, service-account
  credential, VAPID key, or outbound delivery is enabled. See
  `docs/FIREBASE_ARCHITECTURE.md`.
- Government SSO/MFA, production bank adapters, managed object storage,
  approved email/SMS relays, and human calibration studies require owners,
  contracts, credentials, and test populations outside this repository.
