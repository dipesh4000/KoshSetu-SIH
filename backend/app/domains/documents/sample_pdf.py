"""Minimal PDF writer for synthetic demo instruments.

It emits a text-native single-page PDF so the extraction pipeline has real
page text to parse, rather than a hardcoded fixture pretending to be OCR.
"""

from __future__ import annotations


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def build_pdf(lines: list[str], *, title: str = "Fixed Deposit Receipt") -> bytes:
    content_lines = ["BT", "/F1 16 Tf", "60 780 Td", f"({_escape(title)}) Tj", "/F1 11 Tf"]
    for line in lines:
        content_lines.append("0 -22 Td")
        content_lines.append(f"({_escape(line)}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", "replace")

    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    output = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(output))
        output += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_offset = len(output)
    output += f"xref\n0 {len(objects) + 1}\n".encode()
    output += b"0000000000 65535 f \n"
    for offset in offsets:
        output += f"{offset:010d} 00000 n \n".encode()
    output += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n".encode()
    )
    output += b"%%EOF\n"
    return bytes(output)


def instrument_pdf(
    *,
    bank: str,
    branch: str,
    ifsc: str,
    fdr_number: str,
    institution: str,
    principal_amount: str,
    issue_date: str,
    maturity_date: str,
    interest_rate: str,
    lien_beneficiary: str | None,
) -> bytes:
    lines = [
        f"{bank} - {branch}",
        f"IFSC: {ifsc}",
        "",
        f"FDR Number: {fdr_number}",
        f"Depositor: {institution}",
        f"Principal Amount: INR {principal_amount}",
        f"Rate of Interest: {interest_rate} percent per annum",
        f"Date of Deposit: {issue_date}",
        f"Maturity Date: {maturity_date}",
    ]
    if lien_beneficiary:
        lines.append(f"Lien marked in favour of {lien_beneficiary}")
    else:
        lines.append("No lien recorded against this deposit.")
    lines += [
        "",
        "SYNTHETIC DOCUMENT - generated for the SIH26265 prototype.",
        "Not issued by any bank. Not valid for any financial purpose.",
    ]
    return build_pdf(lines, title="Fixed Deposit Receipt (SYNTHETIC)")
