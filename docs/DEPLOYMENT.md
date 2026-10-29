# Deployment and operations

Local development has been tested. The loopback Docker Compose stack is
configured but has not been run locally. A hosted deployment requires an owner to supply a
PostgreSQL service, durable private object storage, secret management, TLS,
backups, monitoring and an identity provider.

## Local process

```powershell
cd backend
python -m pip install -r requirements-dev.txt
$env:PYTHONPATH = "."
python -m app.devserver
```

The server migrates to the current Alembic head, seeds missing synthetic rows,
and listens on port 8000. Start the UI with `cd frontend; npm ci; npm run dev`;
Vite serves port 5173 and proxies `/api` to the backend.

## Compose

```powershell
docker compose up --build
```

Compose runs PostgreSQL, MinIO, API and frontend. Ports are bound to
`127.0.0.1`; MinIO uses a private fixed bucket and is restricted to local
development by application settings. OCR is enabled in the API container.
The credentials in Compose are synthetic local fixtures and must never be
copied into a hosted environment.

## Required hosted settings

Set these through a secret manager or deployment environment:

| Setting | Requirement |
| --- | --- |
| `KOSHSETU_ENVIRONMENT` | `demo` for an approved synthetic environment; `production` only after review |
| `KOSHSETU_DATABASE_URL` | PostgreSQL URL with TLS |
| `KOSHSETU_JWT_SECRET` | Dedicated random secret, at least 32 bytes |
| `KOSHSETU_FDR_HMAC_KEY` | Different dedicated random lookup-key secret |
| `KOSHSETU_ENCRYPTION_KEY` | AES-GCM key material, at least 32 bytes |
| `KOSHSETU_STORAGE_BACKEND` | `database` or an approved storage adapter |
| `KOSHSETU_BOOTSTRAP_SECRET` | Separate operational secret, if bootstrap routes are enabled |
| `KOSHSETU_EXPOSE_DOCS` | `false` outside controlled development |

Production refuses development secrets, the mock bank adapter and local MinIO.
The database must be migrated with `alembic upgrade head` during a controlled
release; the application must not create tables on every hosted cold start.

## Verification before release

```powershell
cd backend
python -m ruff check app tests evaluation
python -m pytest -ra
python -m evaluation.run
cd ..\frontend
npm ci
npm run lint
npm run build
npm audit --audit-level=high
```

Run the PostgreSQL concurrency tests with an isolated
`KOSHSETU_TEST_DATABASE_URL`. Review the synthetic evaluation output; it does
not measure real bank documents or human reviewer calibration.

## Vercel demo deployment

Deploy from the repository root. `vercel.json` builds the Vite frontend with
`npm ci`, routes `/api/*` to `api/index.py`, and uses Python 3.12 from
`.python-version`. Root `requirements.txt` includes the backend's **runtime**
pins, so the function and everything else share one source of versions without
the function carrying tooling it never invokes:

| File | Installs | Used by |
| --- | --- | --- |
| `backend/requirements.txt` | API runtime | the hosted function |
| `backend/requirements-server.txt` | + uvicorn, alembic, boto3 | container and local runs |
| `backend/requirements-dev.txt` | + pytest, ruff, pip-audit, Pillow | tests, lint, audit, evaluation |

That keeps the function around 168 MB against a 250 MB limit, instead of the
212 MB it reaches when it installs the full set. The existing Singapore region
and daily cron are retained.

The configuration sets `demo` mode, database document storage, disables
automatic schema creation, and disables OCR (Tesseract is not bundled in the
Python function). Native PDF extraction and manual review remain available.
Configure the PostgreSQL URL and secrets listed above in Vercel settings.
Set `CRON_SECRET` equal to `KOSHSETU_BOOTSTRAP_SECRET` for the daily scan.

After deployment, send an authenticated POST to
`/api/v1/ops/bootstrap?step=schema` to create missing demo tables, then use
`step=seed` for a new synthetic database. Existing rows are preserved. Check
`/api/v1/health` and sign in to verify the deployment. Do not use `--reset`.
Retain previous encryption keys during rotation so existing ciphertext remains
readable; do not replace a key without a migration plan.

## Integration status

The repository does not activate Firebase, SMTP, SMS, real bank adapters,
government SSO/MFA or managed cloud storage. The in-app notification outbox is
the active delivery path. See `docs/FIREBASE_ARCHITECTURE.md` for the future
FCM contract and required approvals.
