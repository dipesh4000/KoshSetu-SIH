# Improvement plan progress

Source: `KoshSetu_Improvement_Plan.docx`.

## First increment

- Parser v2 requires explicit principal labels and valid Indian/western numeric grouping.
- Fields are parsed within a single line, avoiding receipt-title and adjacent-date capture.
- Missing critical fields, contradictory principal values and invalid date ordering require review.
- Invented bounding boxes removed; source text and page navigation retained.
- UI and documentation identify scores as uncalibrated heuristics.
- README bank scenarios and clearance identifiers aligned with the implementation.
- Eight native-PDF regression tests added; full backend suite passes.

## Remaining P0 work

- Broader issuer recognition, conflicting-date detection, maturity-value and submitted-value checks.
- Labelled extraction evaluation and calibrated confidence; real coordinates and OCR remain pending.
- Concurrent approval and audit serialization, authenticated encryption, login throttling,
  session revocation, regional scope rules and persistent replay protection.
- Explicit MFA limitations and full documentation/API catalogue reconciliation.

This increment does not claim completion of the plan, calibrated extraction accuracy, or OCR support.
