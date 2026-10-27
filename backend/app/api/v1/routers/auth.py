"""Demo authentication.

This is deliberately a local, demonstrable session mechanism. The brief
requires an approved OIDC identity provider with MFA for officials in any real
deployment, and nothing here claims government SSO.
"""

from __future__ import annotations

import secrets
import hashlib
from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from app.api import schemas
from app.api.deps import (
    CSRF_COOKIE,
    SESSION_COOKIE,
    CurrentPrincipal,
    DbSession,
    build_principal,
    request_id_of,
)
from app.core.authorization import INSTITUTION_ROLES, Principal
from app.core.config import settings
from app.core.security import (
    create_access_token,
    verify_password,
    hash_password,
    session_fingerprint,
    decode_access_token,
)
from app.db.models import Institution, User, RoleAssignment, RevokedSession, LoginBucket
from app.db.base import utcnow, as_utc
from app.db.locking import transaction_lock
from app.domains.audit.service import record_audit

router = APIRouter(tags=["session"])
_DUMMY_HASH = hash_password(secrets.token_urlsafe(32))


def _login_buckets(db, request, email):
    # Forwarded headers are trusted only when uvicorn has a trusted proxy configured.
    ip = request.client.host if request.client else "unknown"
    buckets = []
    for label, value, limit in (
        ("account", email, settings.login_account_limit),
        ("ip", ip, settings.login_ip_limit),
    ):
        key = hashlib.sha256(f"{label}:{value}".encode()).hexdigest()
        transaction_lock(db, f"login:{key}")
        bucket = db.get(LoginBucket, key)
        now = utcnow()
        if bucket is None:
            bucket = LoginBucket(
                id=key,
                attempts=0,
                reset_at=now + timedelta(seconds=settings.login_window_seconds),
            )
            db.add(bucket)
        elif as_utc(bucket.reset_at) <= now:
            bucket.attempts = 0
            bucket.reset_at = now + timedelta(seconds=settings.login_window_seconds)
        if bucket.attempts >= limit:
            record_audit(
                db,
                aggregate_type="authentication",
                aggregate_id="login",
                action="auth.throttled",
                outcome="DENY",
                request_id=request_id_of(request),
            )
            db.commit()
            raise HTTPException(
                429,
                detail={
                    "code": "LOGIN_THROTTLED",
                    "message": "Too many sign-in attempts. Try again later.",
                },
                headers={
                    "Retry-After": str(
                        max(1, int((as_utc(bucket.reset_at) - now).total_seconds()))
                    )
                },
            )
        bucket.attempts += 1
        buckets.append(bucket)
    return buckets


def _workspace(principal: Principal) -> str:
    if principal.roles & INSTITUTION_ROLES:
        return "institution"
    if "ADMIN" in principal.roles and len(principal.roles) == 1:
        return "admin"
    return "official"


def _session_out(
    principal: Principal, csrf_token: str | None = None
) -> schemas.SessionOut:
    return schemas.SessionOut(
        user_id=principal.user_id,
        email=principal.email,
        display_name=principal.display_name,
        roles=sorted(principal.roles),
        capabilities=sorted(principal.capabilities),
        institution_ids=sorted(principal.institution_ids),
        region_codes=sorted(principal.region_codes),
        bureau_codes=sorted(principal.bureau_codes),
        mfa_enrolled=principal.mfa_enrolled,
        workspace=_workspace(principal),
        csrf_token=csrf_token,
    )


@router.post("/auth/login", response_model=schemas.SessionOut)
def login(
    payload: schemas.LoginIn, request: Request, response: Response, db: DbSession
):
    buckets = _login_buckets(db, request, str(payload.email).lower())
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    authenticated = verify_password(
        payload.password, user.password_hash if user else _DUMMY_HASH
    )

    if not authenticated or user is None or not user.active:
        record_audit(
            db,
            aggregate_type="user",
            aggregate_id=user.id if user else "unknown",
            action="auth.login",
            outcome="DENY",
            reason="Invalid credentials or inactive account",
            request_id=request_id_of(request),
        )
        db.commit()
        # A single generic message: the response must not reveal whether the
        # address exists.
        raise _invalid_credentials()

    buckets[0].attempts = 0
    assignments = list(
        db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id))
    )
    token = create_access_token(
        user.id,
        extra_claims={"session_fingerprint": session_fingerprint(user, assignments)},
    )
    csrf_token = secrets.token_urlsafe(24)
    secure = settings.environment != "local"
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.jwt_ttl_minutes * 60,
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token,
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=settings.jwt_ttl_minutes * 60,
        path="/",
    )

    principal = build_principal(db, user)
    record_audit(
        db,
        aggregate_type="user",
        aggregate_id=user.id,
        action="auth.login",
        actor=principal,
        new_state={"roles": sorted(principal.roles)},
        request_id=request_id_of(request),
    )
    db.commit()
    return _session_out(principal, csrf_token)


def _invalid_credentials():
    from fastapi import HTTPException

    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "AUTHENTICATION_REQUIRED",
            "message": "Those sign-in details were not accepted.",
        },
    )


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, principal: CurrentPrincipal, db: DbSession) -> Response:
    # The deletions must be set on the response that is actually returned,
    # otherwise the session cookie survives the sign-out.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        token = request.headers.get("authorization", "").split(" ", 1)[-1]
    claims = decode_access_token(token)
    if db.get(RevokedSession, claims["jti"]) is None:
        db.add(
            RevokedSession(
                id=claims["jti"],
                expires_at=datetime.fromtimestamp(claims["exp"], timezone.utc),
            )
        )
    record_audit(
        db,
        aggregate_type="user",
        aggregate_id=principal.user_id,
        action="auth.logout",
        actor=principal,
        request_id=request_id_of(request),
    )
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return response


@router.get("/me", response_model=schemas.SessionOut)
def me(principal: CurrentPrincipal, request: Request):
    return _session_out(principal, request.cookies.get(CSRF_COOKIE))


@router.get("/institutions/me", response_model=list[schemas.InstitutionOut])
def my_institutions(principal: CurrentPrincipal, db: DbSession):
    """Institution context comes from the session, never from a client-sent id."""
    if not principal.institution_ids:
        return []
    institutions = db.scalars(
        select(Institution).where(Institution.id.in_(principal.institution_ids))
    )
    return [schemas.InstitutionOut.model_validate(item) for item in institutions]


@router.get("/institutions", response_model=list[schemas.InstitutionOut])
def list_institutions(principal: CurrentPrincipal, db: DbSession):
    principal.require("fdr:read_all")
    statement = select(Institution).order_by(Institution.name)
    if principal.region_codes:
        statement = statement.where(Institution.region_code.in_(principal.region_codes))
    elif principal.labels.get("global_scope") != "true":
        return []
    return [
        schemas.InstitutionOut.model_validate(item) for item in db.scalars(statement)
    ]
