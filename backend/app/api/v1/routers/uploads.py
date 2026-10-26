"""Upload sessions, scanning, extraction and authorized download tickets.

The browser never receives a storage URL. An upload session reserves a
generated quarantine key with size and type bounds; the object is validated
server-side after transfer; and a document is only ever readable through a
short-lived ticket issued to an authorized reader.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api import schemas
from app.api.deps import CurrentPrincipal, DbSession, load_scoped_fdr, request_id_of
from app.core.authorization import conflict, invalid, not_found
from app.core.config import settings
from app.core.security import sha256_bytes
from app.db.base import as_utc, new_id, utcnow
from app.db.models import FdrDocument, FdrExtraction, UploadSession
from app.domains.audit.service import record_audit
from app.domains.documents import extraction as extraction_engine
from app.domains.documents.scanner import scan
from app.domains.fdr import service
from app.domains.risk.engine import sync_findings
from app.infrastructure.storage import local_store

router = APIRouter(tags=["documents"])

UPLOAD_SESSION_TTL_MINUTES = 15
DOWNLOAD_TICKET_TTL_SECONDS = 120


@router.post(
    "/upload-sessions",
    response_model=schemas.UploadSessionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_upload_session(
    payload: schemas.UploadSessionIn,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    principal.require("document:upload")
    fdr = load_scoped_fdr(db, principal, payload.fdr_id)
    if fdr.submission_status not in {"DRAFT", "UPLOADED", "CORRECTION_REQUESTED"}:
        raise conflict("Documents can only be added to a draft or a correction.")
    if payload.content_type not in settings.allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": "Upload a PDF file.",
            },
        )
    if payload.size_bytes > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": (
                    f"The file exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB "
                    "limit for this environment."
                ),
            },
        )

    session_row = UploadSession(
        id=new_id(),
        fdr_id=fdr.id,
        created_by=principal.user_id,
        object_key=local_store.build_quarantine_key(fdr.institution_id),
        declared_content_type=payload.content_type,
        declared_size_bytes=payload.size_bytes,
        status="PENDING_UPLOAD",
        expires_at=utcnow() + timedelta(minutes=UPLOAD_SESSION_TTL_MINUTES),
    )
    db.add(session_row)
    record_audit(
        db,
        aggregate_type="upload_session",
        aggregate_id=session_row.id,
        action="upload.session_created",
        actor=principal,
        new_state={"fdr_id": fdr.id, "declared_size_bytes": payload.size_bytes},
        request_id=request_id_of(request),
    )
    db.commit()

    return schemas.UploadSessionOut(
        upload_session_id=session_row.id,
        upload_url=f"/api/v1/upload-sessions/{session_row.id}/content",
        method="PUT",
        max_size_bytes=settings.max_upload_bytes,
        accepted_content_types=list(settings.allowed_content_types),
        expires_at=session_row.expires_at,
        notes=(
            "The object is written to a private quarantine namespace. It is not "
            "viewable until security scanning returns a clean verdict."
        ),
    )


@router.put("/upload-sessions/{session_id}/content", status_code=status.HTTP_202_ACCEPTED)
async def upload_content(
    session_id: str,
    file: UploadFile,
    principal: CurrentPrincipal,
    db: DbSession,
):
    """Accept the object into quarantine. Nothing is parsed here."""
    principal.require("document:upload")
    session_row = db.get(UploadSession, session_id)
    if session_row is None or session_row.created_by != principal.user_id:
        raise not_found()
    if session_row.status not in {"PENDING_UPLOAD", "UPLOADED"}:
        raise conflict(f"This upload session is {session_row.status}.")
    if as_utc(session_row.expires_at) < utcnow():
        session_row.status = "EXPIRED"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "UPLOAD_SESSION_EXPIRED",
                "message": "This upload link has expired. Start the upload again.",
            },
        )

    payload = await file.read(settings.max_upload_bytes + 1)
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": "The file exceeds the allowed size."},
        )

    local_store.put_object(session_row.object_key, payload)
    session_row.status = "UPLOADED"
    db.commit()
    return {
        "upload_session_id": session_row.id,
        "received_bytes": len(payload),
        "sha256": sha256_bytes(payload),
        "next": f"/api/v1/upload-sessions/{session_row.id}/finalize",
    }


@router.post("/upload-sessions/{session_id}/finalize", response_model=schemas.UploadFinalizeOut)
def finalize_upload(
    session_id: str,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Verify the stored object, scan it, then extract fields from a clean file.

    Finalizing twice returns the same document rather than creating a second
    one, so a retry after a dropped response is safe.
    """
    principal.require("document:upload")
    session_row = db.get(UploadSession, session_id)
    if session_row is None or session_row.created_by != principal.user_id:
        raise not_found()
    fdr = load_scoped_fdr(db, principal, session_row.fdr_id)

    if session_row.status == "FINALIZED" and session_row.document_id:
        document = db.get(FdrDocument, session_row.document_id)
        if document is not None:
            return _finalize_response(db, principal, fdr, document)

    if session_row.status != "UPLOADED":
        raise conflict("No uploaded object is associated with this session.")
    if not local_store.object_exists(session_row.object_key):
        raise conflict("The object was not found in storage. Upload it again.")

    payload = local_store.read_object(session_row.object_key)
    checksum = sha256_bytes(payload)
    version = (
        db.scalar(
            select(FdrDocument)
            .where(FdrDocument.fdr_id == fdr.id)
            .order_by(FdrDocument.version.desc())
            .limit(1)
        )
    )
    next_version = (version.version + 1) if version else 1

    result = scan(payload, declared_content_type=session_row.declared_content_type)
    document = FdrDocument(
        id=new_id(),
        fdr_id=fdr.id,
        upload_session_id=session_row.id,
        object_key=session_row.object_key,
        original_filename=f"instrument-v{next_version}.pdf",
        sha256=checksum,
        content_type=session_row.declared_content_type,
        size_bytes=len(payload),
        scan_status=result.status,
        scan_detail=result.detail,
        processing_status="QUEUED",
        version=next_version,
        uploaded_by=principal.user_id,
    )
    db.add(document)
    db.flush()

    if result.status == "CLEAN":
        document.object_key = local_store.promote(
            session_row.object_key, to_prefix=local_store.CLEAN_PREFIX
        )
        document.processing_status = "EXTRACTING"
        extraction_result = extraction_engine.extract(payload)
        db.add(
            FdrExtraction(
                id=new_id(),
                document_id=document.id,
                engine=extraction_engine.ENGINE,
                engine_version=extraction_engine.ENGINE_VERSION,
                status=extraction_result.status,
                extracted_json=json.dumps(extraction_result.extracted, sort_keys=True),
                confidence_json=json.dumps(extraction_result.confidences, sort_keys=True),
                bbox_json=json.dumps(extraction_result.provenance, sort_keys=True),
                finished_at=utcnow(),
            )
        )
        document.processing_status = extraction_result.status
        fdr.document_processing_status = extraction_result.status
        if fdr.submission_status == "DRAFT":
            fdr.submission_status = "UPLOADED"
    else:
        document.object_key = local_store.promote(
            session_row.object_key, to_prefix=local_store.REJECTED_PREFIX
        )
        document.processing_status = "BLOCKED"
        fdr.document_processing_status = (
            "QUARANTINED" if result.status == "RETRYABLE_FAILURE" else "REJECTED"
        )

    session_row.status = "FINALIZED"
    session_row.document_id = document.id
    sync_findings(db, fdr)
    record_audit(
        db,
        aggregate_type="fdr_document",
        aggregate_id=document.id,
        action="document.finalized",
        actor=principal,
        new_state={
            "fdr_id": fdr.id,
            "scan_status": document.scan_status,
            "processing_status": document.processing_status,
            "sha256": checksum,
            "version": document.version,
        },
        reason=result.detail,
        request_id=request_id_of(request),
    )
    db.commit()
    return _finalize_response(db, principal, fdr, document)


def _finalize_response(db, principal, fdr, document) -> schemas.UploadFinalizeOut:
    extraction = db.scalar(
        select(FdrExtraction)
        .where(FdrExtraction.document_id == document.id)
        .order_by(FdrExtraction.created_at.desc())
        .limit(1)
    )
    return schemas.UploadFinalizeOut(
        document_id=document.id,
        scan_status=document.scan_status,
        scan_detail=document.scan_detail or "",
        processing_status=document.processing_status,
        extraction_status=extraction.status if extraction else None,
        evidence_fields=service.evidence_fields(db, fdr),
        document_processing_status=fdr.document_processing_status,
    )


@router.post("/fdrs/{fdr_id}/documents/{document_id}/reparse", response_model=schemas.UploadFinalizeOut)
def reparse_document(
    fdr_id: str,
    document_id: str,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Re-run extraction on a clean document, preserving earlier evidence rows."""
    principal.require("document:reparse")
    fdr = load_scoped_fdr(db, principal, fdr_id)
    document = db.get(FdrDocument, document_id)
    if document is None or document.fdr_id != fdr.id:
        raise not_found()
    if document.scan_status != "CLEAN":
        raise conflict("Only a document that passed scanning can be parsed.")

    payload = local_store.read_object(document.object_key)
    if sha256_bytes(payload) != document.sha256:
        raise conflict("The stored object no longer matches its recorded checksum.")

    result = extraction_engine.extract(payload)
    db.add(
        FdrExtraction(
            id=new_id(),
            document_id=document.id,
            engine=extraction_engine.ENGINE,
            engine_version=extraction_engine.ENGINE_VERSION,
            status=result.status,
            extracted_json=json.dumps(result.extracted, sort_keys=True),
            confidence_json=json.dumps(result.confidences, sort_keys=True),
            bbox_json=json.dumps(result.provenance, sort_keys=True),
            finished_at=utcnow(),
        )
    )
    document.processing_status = result.status
    fdr.document_processing_status = result.status
    sync_findings(db, fdr)
    record_audit(
        db,
        aggregate_type="fdr_document",
        aggregate_id=document.id,
        action="document.reparsed",
        actor=principal,
        new_state={"processing_status": result.status},
        request_id=request_id_of(request),
    )
    db.commit()
    return _finalize_response(db, principal, fdr, document)


@router.post("/fdrs/{fdr_id}/documents/{document_id}/download-ticket")
def issue_download_ticket(
    fdr_id: str,
    document_id: str,
    principal: CurrentPrincipal,
    db: DbSession,
    request: Request,
):
    """Issue a single-document, short-lived read ticket."""
    principal.require("document:read")
    fdr = load_scoped_fdr(db, principal, fdr_id)
    document = db.get(FdrDocument, document_id)
    if document is None or document.fdr_id != fdr.id:
        raise not_found()
    if document.scan_status != "CLEAN":
        raise conflict("A document that has not passed scanning cannot be opened.")

    expires = datetime.now(timezone.utc) + timedelta(seconds=DOWNLOAD_TICKET_TTL_SECONDS)
    ticket = jwt.encode(
        {
            "sub": principal.user_id,
            "doc": document.id,
            "fdr": fdr.id,
            "exp": int(expires.timestamp()),
            "purpose": "document-read",
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    record_audit(
        db,
        aggregate_type="fdr_document",
        aggregate_id=document.id,
        action="document.download_ticket_issued",
        actor=principal,
        new_state={"fdr_id": fdr.id, "expires_at": expires.isoformat()},
        request_id=request_id_of(request),
    )
    db.commit()
    return {
        "ticket": ticket,
        "url": f"/api/v1/documents/content?ticket={ticket}",
        "expires_at": expires.isoformat(),
        "ttl_seconds": DOWNLOAD_TICKET_TTL_SECONDS,
    }


@router.get("/documents/content")
def download_document(ticket: str, db: DbSession):
    """Stream a document for a valid, unexpired ticket.

    The ticket is re-checked against the reader's current scope on every use,
    so a revoked role cannot keep reading with an old link.
    """
    try:
        claims = jwt.decode(ticket, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "INVALID_TICKET", "message": "This document link is no longer valid."},
        ) from None
    if claims.get("purpose") != "document-read":
        raise invalid("Unexpected ticket purpose")

    from app.api.deps import build_principal
    from app.db.models import User

    user = db.get(User, claims["sub"])
    if user is None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "INSUFFICIENT_SCOPE", "message": "Access has been withdrawn."},
        )
    principal = build_principal(db, user)
    fdr = load_scoped_fdr(db, principal, claims["fdr"])
    document = db.get(FdrDocument, claims["doc"])
    if document is None or document.fdr_id != fdr.id or document.scan_status != "CLEAN":
        raise not_found()

    payload = local_store.read_object(document.object_key)
    return StreamingResponse(
        iter([payload]),
        media_type=document.content_type,
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'inline; filename="{document.original_filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.options("/documents/content")
def document_content_preflight() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
