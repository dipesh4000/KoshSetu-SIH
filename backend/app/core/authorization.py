"""Server-side authorization.

Every protected route resolves a Principal from the validated session and then
asks for a capability. Hiding a control in the UI is not an access control, so
each route also scopes its database query to the principal.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import HTTPException, status

ROLE_CAPABILITIES: dict[str, set[str]] = {
    "INSTITUTION_SUBMITTER": {
        "fdr:read",
        "fdr:draft",
        "fdr:submit",
        "document:upload",
        "document:read",
        "release:request",
        "release:read",
        "notification:read",
        "replacement:create",
    },
    "INSTITUTION_APPROVER": {
        "fdr:read",
        "fdr:attest",
        "document:read",
        "release:request",
        "release:read",
        "notification:read",
    },
    "SCRUTINY_OFFICER": {
        "fdr:read",
        "fdr:read_all",
        "fdr:review",
        "document:read",
        "document:reparse",
        "verification:mock_bank",
        "finding:read",
        "finding:dispose",
        "release:read",
        "release:prepare",
        "notification:read",
        "report:read",
        "audit:read",
    },
    "SUPERVISOR": {
        "fdr:read",
        "fdr:read_all",
        "fdr:review",
        "document:read",
        "finding:read",
        "finding:dispose",
        "release:read",
        # A supervisor may prepare a case, but the separation-of-duties check
        # then prevents that same person from being its final approver.
        "release:prepare",
        "release:approve",
        "notification:read",
        "report:read",
        "report:export",
        "audit:read",
    },
    "CLEARANCE_OFFICER": {
        "fdr:read",
        "fdr:read_all",
        "document:read",
        "release:read",
        "release:clear",
        "notification:read",
    },
    "AUDITOR": {
        "fdr:read",
        "fdr:read_all",
        "document:read",
        "finding:read",
        "release:read",
        "audit:read",
        "report:read",
        "report:export",
        "notification:read",
    },
    "ADMIN": {
        "admin:manage",
        "fdr:read",
        "fdr:read_all",
        "notification:read",
        "audit:read",
        "report:read",
    },
}

INSTITUTION_ROLES = {"INSTITUTION_SUBMITTER", "INSTITUTION_APPROVER"}


@dataclass(frozen=True)
class Principal:
    user_id: str
    email: str
    display_name: str
    roles: frozenset[str]
    institution_ids: frozenset[str]
    region_codes: frozenset[str]
    bureau_codes: frozenset[str]
    capabilities: frozenset[str]
    is_active: bool
    mfa_enrolled: bool = False
    labels: dict[str, str] = field(default_factory=dict)

    @property
    def is_institution_user(self) -> bool:
        return bool(self.roles & INSTITUTION_ROLES)

    @property
    def is_official(self) -> bool:
        return bool(self.roles - INSTITUTION_ROLES)

    def has(self, capability: str) -> bool:
        return self.is_active and capability in self.capabilities

    def require(self, capability: str) -> None:
        if not self.has(capability):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_SCOPE",
                    "message": "You do not have permission to perform this action.",
                },
            )


def capabilities_for(roles: set[str]) -> set[str]:
    resolved: set[str] = set()
    for role in roles:
        resolved |= ROLE_CAPABILITIES.get(role, set())
    return resolved


def not_found() -> HTTPException:
    """Out-of-scope records are concealed rather than confirmed."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "NOT_FOUND", "message": "Record not found or not in your scope."},
    )


def conflict(message: str, code: str = "STATE_CONFLICT") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail={"code": code, "message": message}
    )


def invalid(message: str, code: str = "VALIDATION_FAILED") -> HTTPException:
    return HTTPException(status_code=422, detail={"code": code, "message": message})
