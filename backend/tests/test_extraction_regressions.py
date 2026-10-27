"""Synthetic native-PDF regressions; runnable without the seeded API fixtures.

Run from backend: python -m unittest discover -s tests -p test_extraction_regressions.py
"""

import unittest

from app.domains.documents.extraction import extract
from app.domains.documents.sample_pdf import build_pdf


class ExtractionRegressions(unittest.TestCase):
    def receipt(
        self,
        *amounts,
        bank="State Bank of India",
        issue="2024-01-01",
        maturity="2026-01-01",
    ):
        return extract(
            build_pdf(
                [
                    bank,
                    "FDR Number: 5010022334455",
                    *amounts,
                    f"Issue Date: {issue}",
                    f"Maturity Date: {maturity}",
                ]
            )
        )

    def test_header_and_reference_are_not_principal(self):
        result = self.receipt("Principal Amount: INR 25,00,000.00")
        self.assertEqual(result.extracted["principal_amount"], "2500000.00")
        self.assertEqual(result.extracted["issuer_bank"], "State Bank of India")
        self.assertEqual(result.status, "READY")
        for name in ("principal_amount", "issuer_bank", "issue_date", "maturity_date"):
            bbox = result.fields[name].bbox
            self.assertIsNotNone(bbox)
            self.assertTrue(all(0 <= coordinate <= 1 for coordinate in bbox))

    def test_maturity_and_interest_do_not_override_principal(self):
        result = self.receipt(
            "Maturity Amount: INR 3000000.00",
            "Interest Amount: INR 500000.00",
            "Principal: INR 2500000.00",
        )
        self.assertEqual(result.extracted["principal_amount"], "2500000.00")

    def test_unlabelled_amount_is_not_guessed(self):
        for line in (
            "INR 2500000.00",
            "Maturity Amount: INR 3000000.00",
            "Deposit Number: 5010022334455",
        ):
            with self.subTest(line=line):
                result = self.receipt(line)
                self.assertIsNone(result.extracted["principal_amount"])
                self.assertEqual(result.status, "MANUAL_REVIEW_REQUIRED")

    def test_grouping_is_validated(self):
        for amount in ("2500000", "2,500,000.00", "25,00,000.00"):
            self.assertEqual(
                self.receipt(f"Deposit Amount: {amount}").extracted["principal_amount"],
                "2500000.00",
            )
        for amount in ("2,50,00.00", "2500000.123", "0.00", "-2500.00"):
            self.assertIsNone(
                self.receipt(f"Principal Amount: {amount}").extracted[
                    "principal_amount"
                ]
            )

    def test_conflicting_principals_require_review(self):
        result = self.receipt("Principal: 2500000.00", "Principal Amount: 2000000.00")
        self.assertEqual(result.status, "MANUAL_REVIEW_REQUIRED")
        self.assertEqual(result.confidences["principal_amount"], 0)

    def test_invalid_date_order_requires_review(self):
        for maturity in ("2023-01-01", "2024-01-01"):
            result = self.receipt("Principal: 2500000.00", maturity=maturity)
            self.assertEqual(result.status, "MANUAL_REVIEW_REQUIRED")
            self.assertEqual(result.confidences["maturity_date"], 0)

    def test_bank_is_single_line_and_title_is_not_captured(self):
        for bank in (
            "Canara Bank",
            "Bank of Baroda",
            "HDFC Bank",
            "State Bank of India - Chennai",
        ):
            result = self.receipt("Principal: 2500000.00", bank=bank)
            self.assertEqual(result.extracted["issuer_bank"], bank.split(" - ")[0])
        self.assertEqual(
            self.receipt("Principal: 2500000.00", bank="Fixed Deposit Receipt").status,
            "MANUAL_REVIEW_REQUIRED",
        )

    def test_date_cannot_be_borrowed_from_next_line(self):
        result = extract(
            build_pdf(
                [
                    "State Bank of India",
                    "FDR Number: 5010022334455",
                    "Principal: 2500000.00",
                    "Issue Date:",
                    "Maturity Date: 2026-01-01",
                ]
            )
        )
        self.assertIsNone(result.extracted["issue_date"])
        self.assertEqual(result.status, "MANUAL_REVIEW_REQUIRED")

    def test_contradictory_dates_and_maturity_value_require_review(self):
        for extra in ("Issue Date: 2023-01-01", "Maturity Amount: 100.00"):
            result = self.receipt("Principal: 2500000.00", extra)
            self.assertEqual(result.status, "MANUAL_REVIEW_REQUIRED")

    def test_claim_mismatch_requires_review(self):
        from app.domains.documents.extraction import compare_claims

        result = self.receipt("Principal: 2500000.00")
        self.assertEqual(
            compare_claims(result, {"principal_amount": "2000000.00"}).status,
            "MANUAL_REVIEW_REQUIRED",
        )

    def test_maturity_estimate_requires_an_explicit_interest_method(self):
        lines = (
            "Principal: 2500000.00",
            "Interest Rate: 7.00%",
            "Maturity Amount: 5000000.00",
        )
        self.assertEqual(self.receipt(*lines).status, "READY")
        self.assertEqual(
            self.receipt(*lines, "Interest Method: Simple Interest").status,
            "MANUAL_REVIEW_REQUIRED",
        )


if __name__ == "__main__":
    unittest.main()
