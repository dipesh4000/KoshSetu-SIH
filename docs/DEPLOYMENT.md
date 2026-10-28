# Deployment and operations

The supported, verified path is local development and the loopback Docker
Compose stack. A hosted deployment requires an approved owner to supply a
PostgreSQL service, durable private object storage, secret management, TLS,
backups, monitoring and an identity provider.

## Local process

```powershell
cd backend
python -m pip install -r requirements.txt -r requirements-dev.txt
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

## Operational boundaries

The repository does not activate Firebase, SMTP, SMS, real bank adapters,
government SSO/MFA or managed cloud storage. The in-app notification outbox is
the active delivery path. See `docs/FIREBASE_ARCHITECTURE.md` for the future
FCM contract and required approvals.
