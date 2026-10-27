"""Offline cryptographic signature checks; no implied bank authentication."""

import io


def inspect_signatures(payload: bytes) -> dict:
    from pyhanko.pdf_utils.reader import PdfFileReader
    from pyhanko.sign.validation import validate_pdf_signature
    from pyhanko_certvalidator import ValidationContext

    reader = PdfFileReader(io.BytesIO(payload))
    signatures = []
    for signature in reader.embedded_signatures:
        # No implicit system trust store and no certificate URL fetching.
        # Trust and revocation require a separately approved trust policy.
        status = validate_pdf_signature(
            signature,
            signer_validation_context=ValidationContext(
                trust_roots=[], allow_fetching=False
            ),
        )
        signatures.append(
            {
                "field": signature.field_name,
                "intact": status.intact,
                "cryptographically_valid": status.valid,
                "trusted": status.trusted,
                "coverage": status.coverage.name if status.coverage else "UNKNOWN",
                "signer": signature.signer_cert.subject.human_friendly,
                "certificate_sha256": signature.signer_cert.sha256.hex(),
                "revocation_checked": False,
            }
        )
    return {
        "status": "UNSIGNED" if not signatures else "SIGNATURES_PRESENT",
        "signatures": signatures,
        "note": "Offline integrity and signature math only. No approved bank trust roots or live revocation check are configured. A valid signature does not establish FDR authenticity, lien confirmation, or release eligibility.",
    }
