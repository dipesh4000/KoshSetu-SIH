"""Reproducible synthetic extraction evaluation; no real-receipt accuracy claim.

From backend: python -m evaluation.run
"""

import json
import math
import platform
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fitz

from app.domains.documents.extraction import CRITICAL, extract
from app.domains.documents.sample_pdf import build_pdf

ROOT = Path(__file__).resolve().parent


def wilson(correct, total):
    if not total:
        return None
    z = 1.96
    p = correct / total
    centre = (p + z * z / (2 * total)) / (1 + z * z / total)
    radius = (
        z
        * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total))
        / (1 + z * z / total)
    )
    return [round(centre - radius, 4), round(centre + radius, 4)]


def baseline(payload):
    """Frozen original v1 principal/bank heuristics, with native pypdf text.

    This targeted baseline reproduces the reported failure modes, not an
    alternative production parser or the full old application.
    """
    import io
    from pypdf import PdfReader

    text = "\n".join(
        page.extract_text() or "" for page in PdfReader(io.BytesIO(payload)).pages
    )
    amount = None
    for pattern in (
        r"(?:principal|deposit|amount|sum)[^0-9₹]{0,40}(?:₹|rs\.?|inr)?\s*([0-9][0-9,]{2,})(?:\.(\d{2}))?",
        r"(?:₹|rs\.?|inr)\s*([0-9][0-9,]{2,})(?:\.(\d{2}))?",
    ):
        match = re.search(pattern, text, re.I)
        if match:
            amount = f"{float(match[1].replace(',', '') + ('.' + match[2] if match[2] else '')):.2f}"
            break
    match = re.search(r"([A-Z][A-Za-z&.\s]{3,40}\sBank(?:\sof\s[A-Za-z]+)?)", text)
    bank = match[1].strip() if match else None
    return {"principal_amount": amount, "issuer_bank": bank}


def corpus():
    """Three layouts; template C is held out from the development templates."""
    for template, bank, principal_label in (
        ("A", "State Bank of India", "Principal Amount"),
        ("B", "Canara Bank", "Deposit Amount"),
        ("C", "HDFC Bank", "Amount Deposited"),
    ):
        for scenario in (
            "clean",
            "maturity_first",
            "missing_principal",
            "conflicting_principal",
            "invalid_dates",
        ):
            labels = {
                "fdr_number": "5010022334455",
                "principal_amount": "2500000.00",
                "issuer_bank": bank,
                "issue_date": "2024-01-01",
                "maturity_date": "2026-01-01",
            }
            lines = [bank, "FDR Number: 5010022334455"]
            if scenario == "maturity_first":
                lines += ["Maturity Amount: INR 3000000.00"]
            if scenario != "missing_principal":
                lines += [f"{principal_label}: INR 25,00,000.00"]
            else:
                labels["principal_amount"] = None
            if scenario == "conflicting_principal":
                lines += ["Principal: INR 2000000.00"]
            if scenario == "invalid_dates":
                labels["maturity_date"] = "2023-01-01"
            lines += [
                f"Issue Date: {labels['issue_date']}",
                f"Maturity Date: {labels['maturity_date']}",
            ]
            native = build_pdf(lines)
            for condition in ("native", "raster", "degraded"):
                payload = native
                if condition != "native":
                    with fitz.open(stream=native, filetype="pdf") as source:
                        pix = source[0].get_pixmap(
                            matrix=fitz.Matrix(
                                1 if condition == "raster" else 0.65,
                                1 if condition == "raster" else 0.65,
                            ),
                            colorspace=fitz.csGRAY,
                        )
                        if condition == "degraded":
                            # Deterministic contrast loss and sparse noise; not a model of all scans.
                            from PIL import Image, ImageEnhance, ImageFilter
                            import io

                            image = Image.open(io.BytesIO(pix.tobytes("png")))
                            image = (
                                ImageEnhance.Contrast(image)
                                .enhance(0.45)
                                .filter(ImageFilter.GaussianBlur(0.4))
                            )
                            buffer = io.BytesIO()
                            image.save(buffer, format="PNG")
                            raster = buffer.getvalue()
                        else:
                            raster = pix.tobytes("png")
                    with fitz.open() as target:
                        page = target.new_page(width=595, height=842)
                        page.insert_image(page.rect, stream=raster)
                        payload = target.tobytes()
                yield (
                    {
                        "id": f"{template}-{scenario}-{condition}",
                        "template": template,
                        "split": "held-out" if template == "C" else "development",
                        "condition": condition,
                        "scenario": scenario,
                        "labels": labels,
                    },
                    payload,
                )


def main():
    from app.core.config import settings

    data = ROOT / "dataset"
    data.mkdir(exist_ok=True)
    results = []
    metrics = defaultdict(
        lambda: {"correct": 0, "predicted": 0, "expected": 0, "documents": 0}
    )
    reliability = defaultdict(lambda: {"count": 0, "correct": 0})
    silent = ready = 0
    manifest = []
    for label, payload in corpus():
        (data / f"{label['id']}.pdf").write_bytes(payload)
        manifest.append(label)
        result = extract(
            payload,
            ocr_enabled=settings.ocr_enabled,
            ocr_languages=settings.ocr_languages,
        )
        old = baseline(payload)
        wrong = False
        for field in CRITICAL:
            expected, predicted = (
                label["labels"].get(field),
                result.extracted.get(field),
            )
            item = metrics[(label["split"], label["condition"], field)]
            item["documents"] += 1
            item["expected"] += expected is not None
            item["predicted"] += predicted is not None
            item["correct"] += predicted is not None and predicted == expected
            if predicted is not None:
                bucket = reliability[int(result.confidences[field] * 10)]
                bucket["count"] += 1
                bucket["correct"] += predicted == expected
            wrong |= predicted != expected
        if result.status == "READY":
            ready += 1
            silent += bool(
                wrong or label["scenario"] in ("conflicting_principal", "invalid_dates")
            )
        results.append(
            {
                **label,
                "status": result.status,
                "predictions": result.extracted,
                "scores": result.confidences,
                "original_v1_targeted_baseline": old,
            }
        )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "hardware": platform.platform(),
        "documents": len(results),
        "templates": 3,
        "held_out_template": "C",
        "ocr_enabled": settings.ocr_enabled,
        "ready_documents": ready,
        "silent_errors_in_ready": silent,
        "silent_error_interval_95": wilson(silent, ready),
        "metrics": [
            {
                "split": split,
                "condition": condition,
                "field": field,
                **counts,
                "precision": counts["correct"] / counts["predicted"]
                if counts["predicted"]
                else None,
                "coverage": counts["predicted"] / counts["expected"]
                if counts["expected"]
                else None,
                "precision_interval_95": wilson(counts["correct"], counts["predicted"]),
            }
            for (split, condition, field), counts in sorted(metrics.items())
        ],
        "reliability": [
            {
                "score_bin": key / 10,
                **value,
                "observed_accuracy": value["correct"] / value["count"],
            }
            for key, value in sorted(reliability.items())
        ],
        "limitations": [
            "Synthetic receipts only; small template set; no field accuracy claim for real receipts.",
            "The baseline reproduces original principal/bank regex behavior only; no claim to a complete historic application replay.",
            "Scores are not calibrated. Reliability bins describe this synthetic set only.",
            "Raster/degraded pages require configured Tesseract for OCR coverage; without it they require manual review.",
            "Human review speed, SUS, automation bias, OCR CER and production latency require separate studies; none are invented.",
        ],
        "results": results,
    }
    (data / "labels.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (ROOT / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                key: report[key]
                for key in (
                    "documents",
                    "ready_documents",
                    "silent_errors_in_ready",
                    "ocr_enabled",
                )
            }
        )
    )


if __name__ == "__main__":
    main()
