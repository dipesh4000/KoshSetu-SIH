"""Native PDF field extraction.

Text extraction is evidence, not authentication. Every field carries its page
index, the original text it came from, a normalised value and a confidence, and
an unreadable field is reported as not found rather than invented.
"""

from __future__ import annotations

import io
import re
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

ENGINE = "pypdf-native-text"
ENGINE_VERSION = "1"

AMOUNT_PATTERNS = (
    r"(?:principal|deposit|amount|sum)[^0-9₹]{0,40}(?:₹|rs\.?|inr)?\s*([0-9][0-9,]{2,})(?:\.(\d{2}))?",
    r"(?:₹|rs\.?|inr)\s*([0-9][0-9,]{2,})(?:\.(\d{2}))?",
)
DATE_PATTERNS = (
    r"(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})",
    r"(\d{4})-(\d{2})-(\d{2})",
    r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})",
)
MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


@dataclass
class ExtractedField:
    value: str | None
    normalised: str | None
    page_index: int | None
    source_text: str | None
    confidence: float
    bbox: list[float] | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ExtractionResult:
    status: str  # READY | MANUAL_REVIEW_REQUIRED | FAILED
    fields: dict[str, ExtractedField]
    page_texts: list[str]

    @property
    def extracted(self) -> dict[str, Any]:
        return {name: field.normalised for name, field in self.fields.items()}

    @property
    def confidences(self) -> dict[str, float]:
        return {name: field.confidence for name, field in self.fields.items()}

    @property
    def provenance(self) -> dict[str, Any]:
        return {name: field.as_dict() for name, field in self.fields.items()}


def _parse_amount(raw: str, decimals: str | None) -> Decimal | None:
    try:
        cleaned = raw.replace(",", "")
        return Decimal(f"{cleaned}.{decimals}" if decimals else cleaned)
    except InvalidOperation:
        return None


def _parse_date(match: re.Match[str]) -> date | None:
    groups = match.groups()
    try:
        if groups[1].isalpha():
            month = MONTHS.get(groups[1][:3].lower())
            if not month:
                return None
            return date(int(groups[2]), month, int(groups[0]))
        if len(groups[0]) == 4:
            return date(int(groups[0]), int(groups[1]), int(groups[2]))
        return date(int(groups[2]), int(groups[1]), int(groups[0]))
    except ValueError:
        return None


def _page_bbox(page_index: int) -> list[float]:
    """Coarse highlight region.

    A full layout extractor would return real glyph boxes; this reports a
    band so the viewer can point the reviewer at the right part of the page
    without pretending to be more precise than it is.
    """
    return [0.08, 0.18 + 0.08 * (page_index % 4), 0.84, 0.08]


def extract(payload: bytes) -> ExtractionResult:
    from pypdf import PdfReader

    fields: dict[str, ExtractedField] = {
        "fdr_number": ExtractedField(None, None, None, None, 0.0),
        "principal_amount": ExtractedField(None, None, None, None, 0.0),
        "issue_date": ExtractedField(None, None, None, None, 0.0),
        "maturity_date": ExtractedField(None, None, None, None, 0.0),
        "issuer_bank": ExtractedField(None, None, None, None, 0.0),
        "lien_beneficiary": ExtractedField(None, None, None, None, 0.0),
    }

    try:
        reader = PdfReader(io.BytesIO(payload))
        page_texts = [(page.extract_text() or "") for page in reader.pages]
    except Exception:  # noqa: BLE001
        return ExtractionResult("FAILED", fields, [])

    joined = "\n".join(page_texts)
    if not joined.strip():
        # Image-only pages would go to an OCR worker here; until one is wired
        # the document is escalated for manual review, never auto-rejected.
        return ExtractionResult("MANUAL_REVIEW_REQUIRED", fields, page_texts)

    for page_index, text in enumerate(page_texts):
        lowered = text.lower()

        if fields["fdr_number"].value is None:
            match = re.search(
                r"(?:fdr|fd|receipt|deposit|account)\s*(?:no\.?|number|ref(?:erence)?|#)"
                r"\s*[:\-]\s*([A-Z0-9][A-Z0-9/\-]{4,30})",
                text,
                re.IGNORECASE,
            )
            if match:
                fields["fdr_number"] = ExtractedField(
                    match.group(1).strip(),
                    match.group(1).strip().upper(),
                    page_index,
                    match.group(0).strip(),
                    0.93,
                    _page_bbox(page_index),
                )

        if fields["principal_amount"].value is None:
            for pattern in AMOUNT_PATTERNS:
                match = re.search(pattern, lowered, re.IGNORECASE)
                if not match:
                    continue
                amount = _parse_amount(match.group(1), match.group(2) if match.lastindex else None)
                if amount is None or amount <= 0:
                    continue
                fields["principal_amount"] = ExtractedField(
                    match.group(0).strip(),
                    f"{amount:.2f}",
                    page_index,
                    match.group(0).strip(),
                    0.94,
                    _page_bbox(page_index),
                )
                break

        for label, keys in (
            ("issue_date", ("date of deposit", "issue date", "deposit date", "issued on")),
            ("maturity_date", ("maturity date", "date of maturity", "matures on", "due date")),
        ):
            if fields[label].value is not None:
                continue
            for key in keys:
                position = lowered.find(key)
                if position == -1:
                    continue
                window = text[position : position + 80]
                for pattern in DATE_PATTERNS:
                    match = re.search(pattern, window)
                    if not match:
                        continue
                    parsed = _parse_date(match)
                    if parsed is None:
                        continue
                    fields[label] = ExtractedField(
                        match.group(0),
                        parsed.isoformat(),
                        page_index,
                        window.strip().splitlines()[0],
                        0.88,
                        _page_bbox(page_index),
                    )
                    break
                if fields[label].value is not None:
                    break

        if fields["issuer_bank"].value is None:
            match = re.search(r"([A-Z][A-Za-z&.\s]{3,40}\sBank(?:\sof\s[A-Za-z]+)?)", text)
            if match:
                fields["issuer_bank"] = ExtractedField(
                    match.group(1).strip(),
                    match.group(1).strip(),
                    page_index,
                    match.group(0).strip(),
                    0.8,
                    _page_bbox(page_index),
                )

        if fields["lien_beneficiary"].value is None:
            # The beneficiary name is matched case-sensitively so a lower-case
            # label word like "marked" is never captured as the name itself.
            match = re.search(
                r"(?:[Ll]ien|[Pp]ledged|favou?r)[^\n]{0,24}?\b(?:of|to)\b[ \t]*"
                r"([A-Z][A-Za-z&.,()\- ]{2,60})",
                text,
            )
            if match:
                fields["lien_beneficiary"] = ExtractedField(
                    match.group(1).strip(),
                    match.group(1).strip(),
                    page_index,
                    match.group(0).strip(),
                    0.72,
                    _page_bbox(page_index),
                )

    confident = [f for f in fields.values() if f.confidence >= 0.85]
    critical_missing = fields["principal_amount"].value is None or (
        fields["maturity_date"].value is None
    )
    status = "MANUAL_REVIEW_REQUIRED" if critical_missing or len(confident) < 2 else "READY"
    return ExtractionResult(status, fields, page_texts)


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None
