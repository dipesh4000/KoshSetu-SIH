# API surface

Version root `/api/v1`. JSON, RFC-style status semantics, `X-Request-ID` on every response,
`Idempotency-Key` accepted on sensitive writes, `expected_version` on versioned transitions.

## Session

| Method | Path | Authorised caller | Behaviour |
| --- | --- | --- | --- |
| POST | `/auth/login` | anyone | Sets the HttpOnly session cookie and a CSRF cookie. One generic failure message. |
| POST | `/auth/logout` | authenticated | Clears both cookies. |
| GET | `/me` | authenticated | Identity, roles, capabilities, scopes, workspace. |
| GET | `/institutions/me` | institution | Institution context from the session, never a client id. |
| GET | `/institutions` | `fdr:read_all` | Institutions within the officer's region scope. |
| GET | `/meta` | anyone | Environment, bank provider and the demonstration disclaimer. |

## Instruments

| Method | Path | Capability | Behaviour |
| --- | --- | --- | --- |
| GET | `/fdrs` | `fdr:read` | Filtered, paginated, scope-bound register. |
| POST | `/fdrs/drafts` | `fdr:draft` | Creates a draft; institution derived from the session. |
| GET | `/fdrs/{id}` | `fdr:read` | Case detail: evidence fields, documents, checks, findings, decisions, links, permitted actions. |
| PATCH | `/fdrs/{id}/draft` | `fdr:draft` | Draft-only edit; refused once attested. |
| POST | `/fdrs/{id}/submit` | `fdr:submit` | Attest and submit. Idempotent. Requires a scanned, parsed document. |
| POST | `/fdrs/{id}/scrutiny` | `fdr:review` | START_REVIEW / OBSERVE / REQUEST_CLARIFICATION / ACCEPT / REJECT with a reason and version check. |
| POST | `/fdrs/{id}/replacements` | `replacement:create` | Creates and links a successor; predecessor preserved. |
| GET | `/fdrs/{id}/verification-checks` | `fdr:read` | Field outcomes with source, scenario, timestamps. |

## Documents

| Method | Path | Capability | Behaviour |
| --- | --- | --- | --- |
| POST | `/upload-sessions` | `document:upload` | Validates scope, type, size; reserves a quarantine key. |
| PUT | `/upload-sessions/{id}/content` | `document:upload` | Accepts the object into quarantine. Nothing is parsed. |
| POST | `/upload-sessions/{id}/finalize` | `document:upload` | Verifies, scans, extracts. Safe to retry. |
| POST | `/fdrs/{id}/documents/{docId}/reparse` | `document:reparse` | Re-runs extraction, preserving earlier evidence rows. |
| POST | `/fdrs/{id}/documents/{docId}/download-ticket` | `document:read` | Issues a 120-second single-document ticket. |
| GET | `/documents/content?ticket=…` | ticket | Streams the file, re-checking current scope. |

## Verification

| Method | Path | Capability | Behaviour |
| --- | --- | --- | --- |
| GET | `/verification/scenarios` | `verification:mock_bank` | Fixture catalogue, with its disclaimer. |
| POST | `/fdrs/{id}/mock-bank-check` | `verification:mock_bank` | Runs the simulator. Tampered or replayed responses are rejected without a status change. |

## Releases

| Method | Path | Capability | Behaviour |
| --- | --- | --- | --- |
| GET | `/release-policy` | `release:read` | Versioned checklist, bases, bureaus, documents. |
| GET | `/release-requests` | `release:read` | Scope-bound case list with blocking reasons. |
| POST | `/release-requests` | `release:request` | Opens a case and instantiates its clearances. |
| GET | `/release-requests/{id}` | `release:read` | Checklist, clearances, approvals, blocking reasons. |
| POST | `/release-requests/{id}/documents/{docId}` | `release:request` | Attaches a cleared document to a checklist slot. |
| POST | `/release-requests/{id}/clearances/{bureau}/decide` | `release:clear` | Bureau decision; requires assignment to that bureau. |
| POST | `/release-requests/{id}/prepare` | `release:prepare` | Maker step; version checked. |
| POST | `/release-requests/{id}/approve` | `release:approve` | All prerequisites and maker/checker re-checked; idempotent. |
| POST | `/release-requests/{id}/reject` | `release:approve` | Records a rejection with a reason. |

## Dashboards, findings, notifications, audit

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/overview` | `fdr:read` |
| GET | `/maturities?band=7\|15\|30\|60\|90\|OVERDUE\|MATURED` | `fdr:read` |
| GET | `/exceptions` | `finding:read` |
| GET | `/rules` | `finding:read` |
| POST | `/findings/{id}/disposition` | `finding:dispose` |
| GET | `/notifications`, `/notifications/unread-count` | `notification:read` |
| POST | `/notifications/{id}/read`, `/notifications/{id}/ack` | `notification:read` |
| GET | `/reports/{key}` | `report:read` |
| GET | `/reports/{key}/export` | `report:export` |
| GET | `/audit-events`, `/audit-events/integrity` | `audit:read` |
| POST | `/ops/maturity-scan`, `/ops/dispatch-outbox` | `audit:read` |

## Error taxonomy

```json
{
  "error": {
    "code": "CASE_VERSION_CONFLICT",
    "message": "This case changed since you opened it. Review the latest version.",
    "field_errors": {},
    "request_id": "req-…"
  }
}
```

`400 INVALID_INPUT` · `401 AUTHENTICATION_REQUIRED` · `403 INSUFFICIENT_SCOPE` / `CSRF_FAILED` ·
`404 NOT_FOUND` (also used to conceal out-of-scope existence) · `409 STATE_CONFLICT` /
`CASE_VERSION_CONFLICT` / `RELEASE_PREREQUISITES_UNMET` · `413 FILE_TOO_LARGE` ·
`415 UNSUPPORTED_FILE_TYPE` · `422 VALIDATION_FAILED` · `503 DEPENDENCY_UNAVAILABLE`.

Raw SQL, storage paths, credentials and exception text are never returned to the browser.
