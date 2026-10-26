"""KoshSetu — AICTE security deposit / FDR portal API (SIH26265 prototype).

Prototype scope: all data is synthetic and bank verification is simulated. No
response from this service establishes the real-world authenticity of any
instrument.
"""

from __future__ import annotations

import logging
import time
from uuid import uuid4

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.routers import (
    audit,
    auth,
    dashboards,
    fdrs,
    notifications,
    ops,
    releases,
    uploads,
    verification,
)
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger("koshsetu")

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Locally the schema is created directly; the brief's deployment path is
    # reviewed Alembic revisions. A hosted deployment leaves this off and calls
    # the guarded bootstrap route once, so a cold start does no DDL.
    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)
    logger.info(
        "startup environment=%s mock_bank=%s storage=%s",
        settings.environment,
        settings.mock_bank_enabled,
        settings.storage_backend,
    )
    yield


app = FastAPI(
    lifespan=lifespan,
    title="KoshSetu — AICTE FDR Portal API",
    version="1.0.0",
    description=(
        "Prototype API for SIH26265 (Streamline of security deposit / FDR portal). "
        "Bank verification is simulated; a simulated result is never independent "
        "authentication and never bypasses officer review."
    ),
    docs_url=f"{API_PREFIX}/docs" if settings.expose_docs and not settings.is_production else None,
    redoc_url=None,
    openapi_url=f"{API_PREFIX}/openapi.json"
    if settings.expose_docs and not settings.is_production
    else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-CSRF-Token"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Correlation id, timing and the security headers the brief requires."""
    request_id = request.headers.get("x-request-id") or f"req-{uuid4()}"
    request.state.request_id = request_id
    started = time.perf_counter()

    response = await call_next(request)

    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    if settings.environment != "local":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Logged fields stay safe: no bodies, tokens, object keys or instrument numbers.
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%s request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    return response


def _error_response(
    request: Request, status_code: int, code: str, message: str, field_errors: dict | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "field_errors": field_errors or {},
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        return _error_response(
            request,
            exc.status_code,
            detail.get("code", "ERROR"),
            detail.get("message", "The request could not be completed."),
            detail.get("field_errors"),
        )
    default_codes = {
        400: "INVALID_INPUT",
        401: "AUTHENTICATION_REQUIRED",
        403: "INSUFFICIENT_SCOPE",
        404: "NOT_FOUND",
        409: "STATE_CONFLICT",
        413: "FILE_TOO_LARGE",
        415: "UNSUPPORTED_FILE_TYPE",
        422: "VALIDATION_FAILED",
        429: "RATE_LIMITED",
        503: "DEPENDENCY_UNAVAILABLE",
    }
    return _error_response(
        request, exc.status_code, default_codes.get(exc.status_code, "ERROR"), str(detail)
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_errors: dict[str, str] = {}
    for error in exc.errors()[:20]:
        location = ".".join(str(part) for part in error["loc"][1:]) or "body"
        field_errors[location] = error["msg"]
    return _error_response(
        request,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDATION_FAILED",
        "Some values could not be accepted. Check the highlighted fields.",
        field_errors,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never echo exception text, SQL or storage paths to the browser.
    logger.exception("unhandled error request_id=%s", getattr(request.state, "request_id", None))
    return _error_response(
        request,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "Something went wrong. Quote the request id if you report this.",
    )


@app.get("/health", tags=["meta"])
@app.get(f"{API_PREFIX}/health", tags=["meta"])
def health():
    """Liveness. Also exposed under the API prefix, because a static host may
    route only `/api/*` to this application."""
    return {"status": "ok", "environment": settings.environment}


@app.get(f"{API_PREFIX}/meta", tags=["meta"])
def meta():
    """Environment provenance the UI shows in its persistent banner."""
    return {
        "environment": settings.environment,
        "bank_provider": "MOCK_BANK" if settings.mock_bank_enabled else "NONE",
        "is_simulated_environment": settings.mock_bank_enabled,
        "problem_statement_id": "SIH26265",
        "problem_statement_title": "Streamline of security deposit / FDR portal",
        "issuer": "All India Council for Technical Education (AICTE), Regulation Bureau",
        "disclaimer": (
            "Demonstration prototype. All institutions, instruments, clearances and bank "
            "responses are synthetic. The portal is not connected to any bank or AICTE "
            "production system and does not move funds."
        ),
    }


for router in (
    auth.router,
    fdrs.router,
    uploads.router,
    verification.router,
    releases.router,
    dashboards.router,
    notifications.router,
    audit.router,
    ops.router,
):
    app.include_router(router, prefix=API_PREFIX)
