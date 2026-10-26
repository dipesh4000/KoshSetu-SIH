# Demonstration script

Roughly seven minutes over the seeded data. Every record is synthetic.

Start the API and the web app, run `python -m app.seed --reset`, and open
<http://localhost:5173>. All accounts use `Demo@12345`.

---

## 1. Officer overview — `scrutiny@aicte.demo`

`/official/overview`

Point out the two pills that never leave the screen: **DEMO ENVIRONMENT** and **BANK: SIMULATED**.
Then the KPI row — each figure states what it counts and when it was calculated, and the scope line
reads “Assigned region: SOUTH, WEST”, not a global total. The maturity chart ships with the same
numbers as a table underneath.

## 2. Institution submission — `submitter@coastal.demo`

`/institution/fdrs/new`

Walk the five steps. The institution is taken from the session and is not editable. The draft is
saved *before* any file is transferred. On upload, the states shown are the server's real ones —
uploaded → scanning → extracting → ready — not a timer-driven progress bar. Note the copy: “The
file is uploaded. Security scanning is still running. Do not submit until the file is cleared.”

## 3. The mismatch — `scrutiny@aicte.demo`

`/official/exceptions` → the **DATA-001** finding, then “Open the instrument and its evidence”.

The split view shows the document on the left, four separate readings on the right. Principal
amount: submitted ₹25,00,000.00, extracted ₹20,00,000.00, marked **Value differs** with its page,
confidence and source text. Click **Show in document** — the viewer jumps to the page and
highlights the region, and announces it for screen readers.

Say the quiet part out loud: the finding reads *“This is an inconsistency to resolve, not evidence
of forgery.”* There is no fraud score anywhere in this product.

Note the FDR number row: **Masked — full reference is never displayed**, and **Not compared**.

## 4. Bank simulation

On the same case, **Run bank simulation**. The dialog names the provider as a simulator and offers
the fixture scenarios.

- Run `AMOUNT_MISMATCH` → the check is stored as `MOCK_BANK` with its scenario, correlation id and
  evidence hash. The badge reads “Mock bank check reported a difference — simulation”.
- Run `INVALID_SIGNATURE` → the portal **rejects** the response. A security event is recorded and
  **no status changes**. Show the banner.

Then record scrutiny. The confirmation dialog states that acceptance here is an administrative
decision in a demo workflow against simulated evidence — not an authenticity assurance.

## 5. Maturity and replacement

`/official/maturities` → the 30-day band. The Bank of Baroda instrument matures in 12 days, with
`MAT-001` and `VERIFY-001` open and a next action naming the owner. Reminder counts come from
deduplicated notification events; press **Run reminder scan** twice to show the second run creates
nothing.

Open a Coastal instrument and **Record replacement**. The successor is created and linked; the
predecessor becomes *superseded* and keeps its dates, amount, documents and check history. Both
sides of the chain stay open for inspection.

## 6. The blocked release — the important one

`/official/releases` → the Highland case, *Clearances pending*.

PGRC is cleared; **FINANCE_BUREAU is pending**. The **Final approval** button is disabled and the
page lists the blocking reasons. Sign in as `pgrc@aicte.demo` and try to clear Finance Bureau — the
server refuses: that officer is not assigned to that bureau.

Sign in as `finance@aicte.demo` and record the clearance. The case moves to **Ready for decision**.

Now as `supervisor@aicte.demo`: **Record case preparation**, then try **Final approval** — refused,
*“the officer who prepared the case cannot be its final approver.”* A second competent authority
completes it. The result is recorded as **Release request approved**, explicitly distinct from a
completed bank release.

## 7. Boundaries and audit

- As `submitter@highland.demo`, paste a Coastal instrument id into the URL → a safe denial, no data.
- As `auditor@aicte.demo`, open `/official/audit`: every action with actor, time, reason and
  correlation id, and no mutation control anywhere. Press **Verify the digest chain** — it
  recomputes and reports what that proves, and what it does not.

Close on the disclaimer: synthetic data, simulated bank, no funds moved, no certification claimed.
