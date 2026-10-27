"""Evidence-aware native PDF extraction with an optional Tesseract OCR fallback.

Scores are conservative, uncalibrated parser signals. READY is a processing
result, never an assertion of issuer authenticity.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import fitz

ENGINE = "pymupdf-text-optional-ocr"
ENGINE_VERSION = "3"
CRITICAL = (
    "fdr_number",
    "principal_amount",
    "issue_date",
    "maturity_date",
    "issuer_bank",
)
BANKS = (
    "State Bank of India",
    "Punjab National Bank",
    "Bank of Baroda",
    "Bank of India",
    "Canara Bank",
    "Union Bank of India",
    "Indian Bank",
    "Bank of Maharashtra",
    "Central Bank of India",
    "Indian Overseas Bank",
    "UCO Bank",
    "Punjab & Sind Bank",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Kotak Mahindra Bank",
    "IDBI Bank",
    "Federal Bank",
    "South Indian Bank",
    "Yes Bank",
    "IndusInd Bank",
)
NUMBER = r"([0-9][0-9,]*)(?:\.(\d{2}))?"
AMOUNT_PATTERNS = (
    r"^[ \t]*(?:principal(?:[ \t]+amount)?|deposit[ \t]+amount|amount[ \t]+deposited)"
    r"[ \t]*(?:[:=-][ \t]*)?(?:(?:\u20b9|rs\.?|inr)[ \t]*)?"
    + NUMBER
    + r"[ \t]*(?:/-)?[ \t]*$",
)
DATE_PATTERN = r"(\d{4}-\d{2}-\d{2}|\d{1,2}[-/ ](?:[A-Za-z]{3,9}|\d{1,2})[-/ ]\d{4})"


@dataclass
class ExtractedField:
    value: str | None = None
    normalised: str | None = None
    page_index: int | None = None
    source_text: str | None = None
    confidence: float = 0.0
    bbox: list[float] | None = None
    method: str = "native"

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ExtractionResult:
    status: str
    fields: dict[str, ExtractedField]
    page_texts: list[str]

    @property
    def extracted(self):
        return {name: field.normalised for name, field in self.fields.items()}

    @property
    def confidences(self):
        return {name: field.confidence for name, field in self.fields.items()}

    @property
    def provenance(self):
        return {name: field.as_dict() for name, field in self.fields.items()}


def _parse_amount(raw: str, decimals: str | None) -> Decimal | None:
    if not re.fullmatch(r"(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})", raw):
        return None
    try:
        amount = Decimal(raw.replace(",", "") + (f".{decimals}" if decimals else ""))
        return amount if 0 < amount < Decimal("10000000000000000") else None
    except InvalidOperation:
        return None


def _date(raw: str) -> str | None:
    for fmt in (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d-%b-%Y",
        "%d %b %Y",
        "%d/%b/%Y",
        "%d-%B-%Y",
        "%d %B %Y",
        "%d/%B/%Y",
    ):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def extract(
    payload: bytes, *, ocr_enabled: bool = False, ocr_languages: str = "eng+hin"
) -> ExtractionResult:
    fields = {
        name: ExtractedField()
        for name in (
            *CRITICAL,
            "lien_beneficiary",
            "maturity_amount",
            "interest_rate",
            "interest_method",
        )
    }
    texts: list[str] = []
    conflicts: set[str] = set()
    unreadable_page = False

    def save(name, value, source, page, bbox, method, score=0.9):
        existing = fields[name]
        if existing.normalised is not None:
            if existing.normalised.casefold() != value.casefold():
                conflicts.add(name)
            return
        fields[name] = ExtractedField(
            value,
            value,
            page,
            source,
            min(score, 0.75) if method == "ocr" else score,
            bbox,
            method,
        )

    try:
        document = fitz.open(stream=payload, filetype="pdf")
    except Exception:
        return ExtractionResult("FAILED", fields, [])
    try:
        for index, page in enumerate(document):
            method = "native"
            textpage = page.get_textpage()
            if not textpage.extractText().strip() and ocr_enabled:
                try:
                    textpage = page.get_textpage_ocr(
                        language=ocr_languages, dpi=200, full=True
                    )
                    method = "ocr"
                except (RuntimeError, ValueError):
                    unreadable_page = True
            text = textpage.extractText()
            texts.append(text)
            if not text.strip():
                unreadable_page = True
            for block in textpage.extractDICT().get("blocks", []):
                for line in block.get("lines", []):
                    source = "".join(span["text"] for span in line["spans"]).strip()
                    if not source:
                        continue
                    x0, y0, x1, y1 = line["bbox"]
                    bbox = [
                        max(0, x0 / page.rect.width),
                        max(0, y0 / page.rect.height),
                        min(1, (x1 - x0) / page.rect.width),
                        min(1, (y1 - y0) / page.rect.height),
                    ]
                    match = re.fullmatch(
                        r"(?:FDR|FD|Receipt|Deposit|Account)[ \t]*(?:No\.?|Number|Ref(?:erence)?|#)[ \t]*[:=-][ \t]*([A-Z0-9][A-Z0-9/\-]{3,79})",
                        source,
                        re.I,
                    )
                    if match:
                        save(
                            "fdr_number", match[1].upper(), source, index, bbox, method
                        )
                    for name, pattern in (
                        ("principal_amount", AMOUNT_PATTERNS[0]),
                        (
                            "maturity_amount",
                            r"^Maturity[ \t]+(?:Amount|Value)[ \t]*[:=-]?[ \t]*(?:(?:INR|Rs\.?|\u20b9)[ \t]*)?"
                            + NUMBER
                            + r"[ \t]*(?:/-)?[ \t]*$",
                        ),
                    ):
                        match = re.fullmatch(pattern, source, re.I)
                        if match:
                            amount = _parse_amount(match[1], match[2])
                            if amount is not None:
                                save(name, f"{amount:.2f}", source, index, bbox, method)
                            else:
                                conflicts.add(name)
                    for name, label in (
                        (
                            "issue_date",
                            "date of deposit|issue date|deposit date|issued on",
                        ),
                        (
                            "maturity_date",
                            "maturity date|date of maturity|matures on|due date",
                        ),
                    ):
                        match = re.fullmatch(
                            r"(?:" + label + r")[ \t]*[:=-]?[ \t]*" + DATE_PATTERN,
                            source,
                            re.I,
                        )
                        if match:
                            value = _date(match[1])
                            if value:
                                save(name, value, source, index, bbox, method)
                            else:
                                conflicts.add(name)
                    bank_line = (
                        re.sub(
                            r"^(?:issuer bank|bank)[ \t]*:[ \t]*",
                            "",
                            source,
                            flags=re.I,
                        )
                        .split(" - ")[0]
                        .strip()
                    )
                    for bank in BANKS:
                        if bank_line.casefold() == bank.casefold():
                            save("issuer_bank", bank, source, index, bbox, method)
                            break
                    else:
                        if re.fullmatch(
                            r"(?:[A-Z][A-Za-z&.]*[ \t]+){0,6}Bank(?:[ \t]+of[ \t]+[A-Z][A-Za-z]+)?(?:[ \t]+Limited)?",
                            bank_line,
                        ):
                            save(
                                "issuer_bank",
                                bank_line,
                                source,
                                index,
                                bbox,
                                method,
                                0.7,
                            )
                    match = re.search(
                        r"(?:lien|pledged|favou?r)[^\n]{0,24}?\b(?:of|to)\b[ \t]*([A-Z][A-Za-z&.,()\- ]{2,80})$",
                        source,
                        re.I,
                    )
                    if match:
                        save(
                            "lien_beneficiary",
                            match[1].strip(),
                            source,
                            index,
                            bbox,
                            method,
                            0.8,
                        )
                    match = re.fullmatch(
                        r"(?:rate of interest|interest rate)[ \t]*[:=-]?[ \t]*(\d{1,2}(?:\.\d{1,2})?)[ \t]*(?:%|percent)(?: per annum| p\.?a\.?)?",
                        source,
                        re.I,
                    )
                    if match:
                        save(
                            "interest_rate",
                            str(Decimal(match[1])),
                            source,
                            index,
                            bbox,
                            method,
                        )
                    if re.fullmatch(
                        r"Interest Method\s*:\s*Simple Interest", source, re.I
                    ):
                        save(
                            "interest_method",
                            "SIMPLE_ACTUAL_365",
                            source,
                            index,
                            bbox,
                            method,
                        )
    except Exception:
        return ExtractionResult("FAILED", fields, texts)
    finally:
        document.close()

    issue = parse_iso_date(fields["issue_date"].normalised)
    maturity = parse_iso_date(fields["maturity_date"].normalised)
    if issue and maturity and maturity <= issue:
        conflicts.update(("issue_date", "maturity_date"))
    principal = fields["principal_amount"].normalised
    maturity_amount = fields["maturity_amount"].normalised
    if principal and maturity_amount and Decimal(maturity_amount) < Decimal(principal):
        conflicts.add("maturity_amount")
    consistency = maturity_value_check(
        {name: value.normalised for name, value in fields.items()}
    )
    if consistency and not consistency["consistent"]:
        conflicts.add("maturity_amount")
    for name in conflicts:
        fields[name].confidence = 0.0
    requires_review = (
        unreadable_page
        or bool(conflicts)
        or any(fields[name].confidence < 0.85 for name in CRITICAL)
    )
    return ExtractionResult(
        "MANUAL_REVIEW_REQUIRED" if requires_review else "READY", fields, texts
    )


def compare_claims(result: ExtractionResult, claims: dict) -> ExtractionResult:
    """A readable document that contradicts a submitted claim still needs review."""
    for name in CRITICAL:
        extracted = result.fields[name].normalised
        claimed = claims.get(name)
        if extracted is None or claimed is None:
            continue
        if name == "principal_amount":
            matches = Decimal(extracted) == Decimal(str(claimed))
        else:
            matches = (
                str(extracted).strip().casefold() == str(claimed).strip().casefold()
            )
        if not matches:
            result.status = "MANUAL_REVIEW_REQUIRED"
    return result


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def maturity_value_check(values: dict) -> dict | None:
    """Estimate only when the receipt explicitly specifies simple interest.

    Actual/365 with a 1% tolerance is a review heuristic, never a bank valuation.
    Compounding, tax and unlabelled interest conventions are not assumed.
    """
    if values.get("interest_method") != "SIMPLE_ACTUAL_365":
        return None
    if any(
        values.get(key) is None
        for key in (
            "principal_amount",
            "maturity_amount",
            "interest_rate",
            "issue_date",
            "maturity_date",
        )
    ):
        return None
    issue, maturity = (
        parse_iso_date(values["issue_date"]),
        parse_iso_date(values["maturity_date"]),
    )
    if not issue or not maturity or maturity <= issue:
        return None
    principal = Decimal(values["principal_amount"])
    expected = principal * (
        1
        + Decimal(values["interest_rate"])
        * Decimal((maturity - issue).days)
        / Decimal(36500)
    )
    tolerance = max(Decimal("1"), expected * Decimal("0.01"))
    return {
        "consistent": abs(Decimal(values["maturity_amount"]) - expected) <= tolerance,
        "estimated": f"{expected:.2f}",
        "observed": values["maturity_amount"],
        "tolerance": f"{tolerance:.2f}",
        "basis": "Explicit simple interest; Actual/365 estimate; 1% tolerance; review only",
    }
