# Deploying KoshSetu to Vercel

One project serves both halves: the built React bundle as static files, and the
FastAPI application as a serverless function under `/api`. Because they share an
origin, the session cookie stays first-party — no `SameSite=None`, no CORS
allowlist, no API base URL to configure in the frontend.

```
https://<project>.vercel.app/            → frontend/dist (static)
https://<project>.vercel.app/api/v1/…    → api/index.py  (FastAPI)
                                              │
                                              └── Postgres (schema + documents)
```

## What is already in the repository

| File | Purpose |
| --- | --- |
| `vercel.json` | Build commands, output directory, `/api` and SPA rewrites, security headers, the daily cron |
| `api/index.py` | Serverless entrypoint; puts `backend/` on the import path and exposes `app` |
| `requirements.txt` | Function dependencies, including `psycopg[binary]` |
| `.vercelignore` | Keeps the venv, local data, tests and the spec documents out of the bundle |

## Steps

### 1. Create the project

In the Vercel dashboard: **Add New → Project**, import `dipesh4000/KoshSetu-SIH`,
leave the root directory as the repository root. `vercel.json` supplies the build
settings, so nothing needs to be typed on this screen. **Do not deploy yet** —
set the environment variables first, otherwise the function will start, find a
development secret and refuse to serve.

### 2. Add Postgres

**Storage → Create Database → Postgres** (Neon). Connect it to the project. It
injects `DATABASE_URL` and `POSTGRES_URL`, either of which the application picks
up automatically; `postgres://` is rewritten to the driver SQLAlchemy needs and
`sslmode=require` is added when the provider omits it.

### 3. Environment variables

**Settings → Environment Variables**, for all environments:

| Name | Value |
| --- | --- |
| `KOSHSETU_ENVIRONMENT` | `demo` |
| `KOSHSETU_STORAGE_BACKEND` | `database` |
| `KOSHSETU_JWT_SECRET` | a fresh 32-byte hex string |
| `KOSHSETU_FDR_HMAC_KEY` | a different fresh 32-byte hex string |
| `KOSHSETU_BOOTSTRAP_SECRET` | a third fresh secret |
| `CRON_SECRET` | the same value as `KOSHSETU_BOOTSTRAP_SECRET` |
| `KOSHSETU_EXPOSE_DOCS` | `false` |

```bash
openssl rand -hex 32     # run three times, one per secret
```

`CRON_SECRET` is what the scheduler sends as a bearer token; the application
also falls back to it if `KOSHSETU_BOOTSTRAP_SECRET` is unset.

> `KOSHSETU_ENVIRONMENT` is `demo`, not `production`. The settings gate refuses
> to start in `production` while the bank simulator is enabled, and this build
> has no authorised bank integration to replace it with.

### 4. Deploy, then bootstrap once

After the first deploy, create the schema and load the synthetic dataset:

```bash
curl -X POST https://<project>.vercel.app/api/v1/ops/bootstrap \
  -H "Authorization: Bearer $KOSHSETU_BOOTSTRAP_SECRET"
```

It is idempotent: a second call reports `"seed": {"status": "skipped"}` and
leaves the data alone. The response carries the row counts, so a successful run
is visible immediately.

**If it returns 504.** A function has a hard duration cap, and loading the whole
dataset over a network connection to the database can exceed it. The stages are
separately addressable for exactly this reason — run them one at a time:

```bash
BASE=https://<project>.vercel.app/api/v1/ops/bootstrap
AUTH="Authorization: Bearer $KOSHSETU_BOOTSTRAP_SECRET"

curl -X POST "$BASE?step=schema"               -H "$AUTH"
curl -X POST "$BASE?step=seed"                 -H "$AUTH"
curl -X POST "$BASE?step=findings&batch=3"     -H "$AUTH"   # repeat, advancing
curl -X POST "$BASE?step=findings&batch=3&offset=3" -H "$AUTH"
curl -X POST "$BASE?step=reminders"            -H "$AUTH"
```

The `findings` stage reports `next_offset` and `remaining`; keep calling with
the returned offset until `remaining` is zero. Each instrument commits on its
own, so a stage cut short keeps what it finished, and re-running a slice is
harmless because evaluation is idempotent.

### 5. Check it

```bash
curl https://<project>.vercel.app/api/v1/health
curl https://<project>.vercel.app/api/v1/meta
curl -H "Authorization: Bearer $KOSHSETU_BOOTSTRAP_SECRET" \
     https://<project>.vercel.app/api/v1/ops/status
```

Then open the site and sign in as `scrutiny@aicte.demo` / `Demo@12345`.

## How the serverless constraints are handled

**No durable filesystem.** Documents are stored in Postgres through the
`database` object store, behind the same facade as the filesystem store, so the
upload, scan, promote and download paths are unchanged. Keys are still
generated, quarantine is still a separate namespace, and nothing is readable
until scanning clears it. The trade-off is the database inflation the
architecture brief warns about, bounded here by the 10 MB upload limit; an
S3-backed adapter remains the deployment path. The settings gate **refuses to
start** on a serverless runtime configured with filesystem storage or SQLite,
rather than losing uploads quietly.

**No long-lived process.** Connections use `NullPool`, because an invocation can
be frozen between requests and a pooled connection cannot be assumed open. Point
`DATABASE_URL` at the provider's pooled endpoint. `pool_pre_ping` is off on this
path: the connection was opened by the request about to use it, so revalidating
it only buys a round trip.

**Put the function in the database's region.** `vercel.json` pins `regions` to
`sin1` because the Neon instance is in Singapore. This matters more than it
looks: a dashboard request issues dozens of queries, each paying the round trip
separately. Measured on this deployment, warm reads went from 4–7 seconds to
under 0.6 once the two were co-located, while a route touching no database was
0.3 seconds either way. **If you move the database, move this setting with it.**

**No background worker.** The maturity scan and outbox dispatch run from
`/api/v1/ops/cron/maturity-scan`, which `vercel.json` schedules daily at 02:00
UTC. It accepts GET (schedulers often send one), requires the bearer secret, and
is idempotent — the dedupe keys mean a repeated run creates no duplicate notice.

**No DDL on every cold start.** `KOSHSETU_AUTO_CREATE_SCHEMA` defaults to on
only for a local run; hosted, the bootstrap route does it once.

## Keeping it honest

The deployment is a demonstration, and the UI says so on every screen. If the
URL is shared:

- Rotate `KOSHSETU_JWT_SECRET` and `KOSHSETU_FDR_HMAC_KEY` if they were ever
  pasted anywhere but the environment settings. The HMAC key signs simulator
  responses and derives instrument lookup tokens.
- Leave `KOSHSETU_EXPOSE_DOCS=false`. The brief asks that interactive API docs
  stay off a public deployment.
- Never load a real instrument document into it. Everything there is synthetic,
  and the disclaimer says so.
- A free Postgres instance is not a backup. Re-running bootstrap on an empty
  database restores the demonstration dataset.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Function fails with “Set KOSHSETU_JWT_SECRET … before deploying” | The secrets are still at their development defaults. |
| “This runtime has no durable filesystem” | `KOSHSETU_STORAGE_BACKEND` is not `database`, or no Postgres is attached. |
| Every API call returns 404 HTML | The `/api/(.*)` rewrite is missing — confirm `vercel.json` is at the repository root. |
| Sign-in succeeds, the next request is 401 | The site is being served over plain HTTP; a `demo` session cookie is `Secure`. |
| `/api/v1/ops/*` returns 503 | No bootstrap secret is configured. |
| Deep links 404 on refresh | The SPA fallback rewrite is missing. |
| Pages load but feel slow | The function and the database are in different regions. Check `regions` in `vercel.json` against where the database actually lives. |
| First request after a quiet spell takes ~10s | A free Postgres instance suspends when idle and the function cold-starts. Open the site a minute before a demo to warm both. |

## Running the same shape locally

```bash
cd backend
KOSHSETU_STORAGE_BACKEND=database \
KOSHSETU_BOOTSTRAP_SECRET=local-preview-secret \
  ./.venv/bin/python -m app.seed --reset
KOSHSETU_STORAGE_BACKEND=database \
KOSHSETU_BOOTSTRAP_SECRET=local-preview-secret \
  ./.venv/bin/uvicorn app.main:app --port 8000
```

Then `cd frontend && npm run dev`. The dev server proxies `/api` to port 8000,
which is the same single-origin arrangement the deployment uses.
