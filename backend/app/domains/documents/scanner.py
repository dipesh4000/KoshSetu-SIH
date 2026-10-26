"""Content validation standing in for an antivirus + document-safety worker.

The checks are the structural ones the brief requires before a file may be
parsed or rendered: declared type is never trusted, magic bytes and size are
checked, encrypted files and obvious active content are refused, and a file is
only ever promoted out of quarantine on a clean verdict.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings

PDF_MAGIC = b"%PDF-"
SUSPICIOUS_MARKERS = (b"/JavaScript", b"/JS", b"/Launch", b"/EmbeddedFile", b"/OpenAction")
MAX_PAGES = 30


@dataclass(frozen=True)
class ScanResult:
    status: str  # CLEAN | REJECTED | RETRYABLE_FAILURE
    detail: str
    page_count: int | None = None


def scan(payload: bytes, *, declared_content_type: str) -> ScanResult:
    if len(payload) == 0:
        return ScanResult("REJECTED", "Empty file.")
    if len(payload) > settings.max_upload_bytes:
        return ScanResult("REJECTED", "File exceeds the allowed upload size.")
    if declared_content_type not in settings.allowed_content_types:
        return ScanResult("REJECTED", f"Content type {declared_content_type} is not accepted.")
    if not payload.startswith(PDF_MAGIC):
        return ScanResult("REJECTED", "File content is not a PDF regardless of its name or type.")

    found = [marker.decode() for marker in SUSPICIOUS_MARKERS if marker in payload]
    if found:
        return ScanResult("REJECTED", f"PDF contains active content: {', '.join(sorted(found))}.")

    try:
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError
    except ImportError:  # pragma: no cover - dependency is pinned
        return ScanResult("RETRYABLE_FAILURE", "Document scanner unavailable.")

    import io

    try:
        reader = PdfReader(io.BytesIO(payload))
        if reader.is_encrypted:
            return ScanResult("REJECTED", "Password-protected PDFs cannot be processed.")
        page_count = len(reader.pages)
    except PdfReadError as exc:
        return ScanResult("REJECTED", f"PDF structure could not be parsed: {exc}")
    except Exception as exc:  # noqa: BLE001 - scanner must never crash the request
        return ScanResult("RETRYABLE_FAILURE", f"Scanner error: {type(exc).__name__}")

    if page_count == 0:
        return ScanResult("REJECTED", "PDF reports zero pages.")
    if page_count > MAX_PAGES:
        return ScanResult("REJECTED", f"Page-count limit of {MAX_PAGES} exceeded.")

    return ScanResult("CLEAN", "No issues found by structural and content checks.", page_count)
