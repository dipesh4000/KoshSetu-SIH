"""Import, analytics, signature and audit-export boundaries."""

import io
from uuid import uuid4

from openpyxl import Workbook


def _csv(reference):
    return (
        "issuer_bank,fdr_number,principal_amount,issue_date,maturity_date\n"
        f"State Bank of India,{reference},2500000.00,2024-01-01,2028-01-01\n"
        "State Bank of India,BAD-DATE,1000.00,2025-01-01,2024-01-01\n"
    ).encode()


def test_csv_import_preview_masks_values_and_commit_is_idempotent(
    institution_client, other_institution_client
):
    reference = f"IMPORT/{uuid4().hex[:12]}"
    preview = institution_client.post(
        "/api/v1/imports/fdrs/preview",
        files={"file": ("deposits.csv", _csv(reference), "text/csv")},
    )
    assert preview.status_code == 200, preview.text
    assert reference not in preview.text
    body = preview.json()
    assert body["valid_rows"] == 1
    assert body["rows"][1]["errors"]
    route = f"/api/v1/imports/fdrs/{body['batch_id']}/commit"
    assert other_institution_client.post(route).status_code == 404
    created = institution_client.post(route)
    assert created.status_code == 200, created.text
    assert created.json()["created"] == 1
    assert institution_client.post(route).json() == created.json()
    detail = institution_client.get(
        "/api/v1/fdrs/" + created.json()["fdr_ids"][0]
    ).json()
    assert detail["status"]["submission_status"] == "DRAFT"


def test_xlsx_formula_is_rejected(institution_client):
    workbook = Workbook()
    workbook.active.append(
        ["issuer_bank", "fdr_number", "principal_amount", "issue_date", "maturity_date"]
    )
    workbook.active.append(
        ["State Bank of India", "XLSX1234", "=1000*2", "2024-01-01", "2028-01-01"]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)
    response = institution_client.post(
        "/api/v1/imports/fdrs/preview", files={"file": ("data.xlsx", buffer.getvalue())}
    )
    assert response.status_code == 422


def test_analytics_respects_permissions(institution_client, officer_client):
    assert institution_client.get("/api/v1/analytics/turnaround").status_code == 403
    response = officer_client.get("/api/v1/analytics/turnaround")
    assert response.status_code == 200
    assert all(
        group["region"] in ("SOUTH", "WEST") for group in response.json()["groups"]
    )


def test_audit_export_is_authorized_and_has_integrity(officer_client, as_user):
    assert officer_client.get("/api/v1/audit-events/export").status_code == 403
    response = as_user("auditor@aicte.demo").get("/api/v1/audit-events/export")
    assert response.status_code == 200
    assert response.json()["integrity"]["verified"]
    assert response.json()["range"]["exported_events"] > 0


def test_unsigned_pdf_is_not_claimed_to_be_signed():
    from app.domains.documents.sample_pdf import build_pdf
    from app.domains.documents.signatures import inspect_signatures

    result = inspect_signatures(build_pdf(["SYNTHETIC RECEIPT"]))
    assert result["status"] == "UNSIGNED"
    assert result["signatures"] == []
