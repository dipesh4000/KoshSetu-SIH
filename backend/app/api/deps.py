"""Request-scoped dependencies: session resolution, CSRF and scoping helpers."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.authorization import Principal, capabilities_for, not_found
from app.core.security import decode_access_token
from app.db.models import Fdr, RoleAssignment, User
from app.db.session import get_db

SESSION_COOKIE = "koshsetu_session"
CSRF_COOKIE = "koshsetu_csrf"
CSRF_HEADER = "x-csrf-token"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

DbSession = Annotated[Session, Depends(get_db)]


def _unauthenticated() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "AUTHENTICATION_REQUIRED", "message": "Sign in to continue."},
    )


def build_principal(db: Session, user: User) -> Principal:
    assignments = list(
        db.scalars(
            select(RoleAssignment).where(
                RoleAssignment.user_id == user.id, RoleAssignment.active.is_(True)
            )
        )
    )
    roles = {a.role for a in assignments}
    return Principal(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        roles=frozenset(roles),
        institution_ids=frozenset(
            a.scope_id for a in assignments if a.scope_type == "INSTITUTION" and a.scope_id
        ),
        region_codes=frozenset(
            a.scope_id for a in assignments if a.scope_type == "REGION" and a.scope_id
        ),
        bureau_codes=frozenset(
            a.scope_id for a in assignments if a.scope_type == "BUREAU" and a.scope_id
        ),
        capabilities=frozenset(capabilities_for(roles)),
        is_active=user.active,
        mfa_enrolled=user.mfa_enrolled,
    )


def get_principal(
    request: Request,
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> Principal:
    token = request.cookies.get(SESSION_COOKIE)
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise _unauthenticated()

    try:
        claims = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise _unauthenticated() from exc

    # CSRF double-submit for cookie-authenticated writes. A bearer caller is
    # not cookie-authenticated, so it is not exposed to cross-site form posts.
    if request.method in UNSAFE_METHODS and request.cookies.get(SESSION_COOKIE):
        header_token = request.headers.get(CSRF_HEADER)
        cookie_token = request.cookies.get(CSRF_COOKIE)
        if not header_token or not cookie_token or header_token != cookie_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "CSRF_FAILED", "message": "The request could not be verified."},
            )

    user = db.get(User, claims["sub"])
    if user is None or not user.active:
        raise _unauthenticated()
    return build_principal(db, user)


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def scoped_fdr_query(principal: Principal):
    """Scope every instrument query to what the principal may legitimately see."""
    statement = select(Fdr)
    if principal.is_official and principal.has("fdr:read_all"):
        if principal.region_codes:
            from app.db.models import Institution

            statement = statement.join(Institution, Fdr.institution_id == Institution.id).where(
                Institution.region_code.in_(principal.region_codes)
            )
        return statement
    if principal.institution_ids:
        return statement.where(Fdr.institution_id.in_(principal.institution_ids))
    return statement.where(Fdr.id == "__no_scope__")


def load_scoped_fdr(db: Session, principal: Principal, fdr_id: str) -> Fdr:
    fdr = db.scalar(scoped_fdr_query(principal).where(Fdr.id == fdr_id))
    if fdr is None:
        raise not_found()
    return fdr


def request_id_of(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")
