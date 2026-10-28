# KoshSetu

KoshSetu is an independent SIH26265 prototype for managing institutional
security deposits and Fixed Deposit Receipts (FDRs). It covers submission,
document review, discrepancy handling, maturity and renewal work, controlled
release requests, analytics, notifications, and an append-only audit history.

The application is a demo with synthetic records. Bank responses come only
from the deterministic `MOCK_BANK` adapter and do not authenticate a real FDR,
confirm a real lien, or move money. Government SSO/MFA and Firebase push
delivery are not enabled.

## Current implementation

- FastAPI modular monolith with SQLAlchemy 2 and Alembic migrations.
- Vite, React, TypeScript, Tailwind, TanStack Query/Table, Recharts and PDF.js.
- SQLite by default; PostgreSQL is supported through `KOSHSETU_DATABASE_URL`.
- Filesystem storage for local development; local-only MinIO is available in
  Compose. Production storage must be approved and configured separately.
- PyMuPDF extraction with source text, page/span coordinates, conflict checks,
  maturity checks, claim comparison, and optional Tesseract `eng+hin` OCR.
- Human-review gates for missing, conflicting, low-confidence, OCR-derived,
  or otherwise unresolved fields. Parser confidence is an uncalibrated signal.
- AES-GCM identifier encryption with key rotation, persistent login throttling,
  session revocation, fail-closed institution scope checks, replay receipts,
  database locks, and digest-chained audit events.
- Bulk CSV/XLSX FDR import with formula rejection, masked preview, validation,
  atomic commit and idempotency.
- Scoped audit export, PDF signature inspection, maturity analytics and a
  dark independently scrollable sidebar.

## Run locally

```powershell
cd backend
python -m pip install -r requirements.txt -r requirements-dev.txt
$env:PYTHONPATH = "."
python -m app.devserver
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The seeded local accounts and demo workflow are
listed in [the demo script](docs/DEMO_SCRIPT.md). The local API is on port
8000. The dev server runs migrations and seeds synthetic data without resetting
existing rows.

## Local Compose stack

`compose.yaml` starts PostgreSQL, MinIO, the API and the frontend. All ports
bind to loopback. It enables OCR and local MinIO only; it does not provide a
production deployment or external cloud credentials.

```powershell
docker compose up --build
```

The Compose frontend uses port 5180 and the API uses port 8001.

## Verification

```powershell
cd backend
python -m ruff check app tests evaluation
python -m pytest -ra
cd ..\frontend
npm run lint
npm run build
npm audit --audit-level=high
```

PostgreSQL concurrency tests run when `KOSHSETU_TEST_DATABASE_URL` points to an
isolated PostgreSQL database. Synthetic extraction evaluation is available at
`python -m evaluation.run`; it reports reproducible measurements and does not
stand in for a human calibration study.

## Documentation authority

- [Current state and approval boundaries](docs/IMPROVEMENT_PROGRESS.md)
- [Implemented architecture](docs/ARCHITECTURE.md)
- [Local and hosted deployment](docs/DEPLOYMENT.md)
- [Demo walkthrough](docs/DEMO_SCRIPT.md)
- [API catalogue](docs/API.md)
- [Firebase future integration guide](docs/FIREBASE_ARCHITECTURE.md)

The detailed backend and frontend specification files are retained as design
references. They are not an implementation contract; the files above and the
code are the current source of truth.
