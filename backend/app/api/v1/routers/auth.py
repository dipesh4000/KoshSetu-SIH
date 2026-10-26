"""Demo authentication.

This is deliberately a local, demonstrable session mechanism. The brief
requires an approved OIDC identity provider with MFA for officials in any real
deployment, and nothing here claims government SSO.
"""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Request, Response, status
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
from app.core.security import create_access_token, verify_password
from app.db.models import Institution, User
from app.domains.audit.service import record_audit

router = APIRouter(tags=["session"])


def _workspace(principal: Principal) -> str:
    if principal.roles & INSTITUTION_ROLES:
        return "institution"
    if "ADMIN" in principal.roles and len(principal.roles) == 1:
        return "admin"
    return "official"


def _session_out(principal: Principal, csrf_token: str | None = None) -> schemas.SessionOut:
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
def login(payload: schemas.LoginIn, request: Request, response: Response, db: DbSession):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    authenticated = user is not None and verify_password(payload.password, user.password_hash)

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

    token = create_access_token(user.id)
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
def logout() -> Response:
    # The deletions must be set on the response that is actually returned,
    # otherwise the session cookie survives the sign-out.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
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
    return [schemas.InstitutionOut.model_validate(item) for item in db.scalars(statement)]
