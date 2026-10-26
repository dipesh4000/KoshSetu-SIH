// Help: what the portal does, what each status means, and — explicitly — what
// this prototype does not do.

import { Card, PageHeader, StatusBadge } from "../components/ui/primitives";
import { useSession } from "../lib/auth/session";

const STATUS_EXPLAINERS: {
  dimension: Parameters<typeof StatusBadge>[0]["dimension"];
  heading: string;
  body: string;
  values: string[];
}[] = [
  {
    dimension: "submission",
    heading: "Institution submission",
    body: "What the institution has done: a draft is private to the institution, and a submission is an attested snapshot that cannot be edited directly afterwards.",
    values: ["DRAFT", "UPLOADED", "SUBMITTED", "CORRECTION_REQUESTED"],
  },
  {
    dimension: "document",
    heading: "Document processing",
    body: "What has happened to the uploaded file. A file is never rendered before security scanning clears it, and extraction identifies text — it does not authenticate the issuer.",
    values: ["QUARANTINED", "EXTRACTING", "READY", "MANUAL_REVIEW_REQUIRED", "REJECTED"],
  },
  {
    dimension: "bank",
    heading: "Bank-source check",
    body: "What a bank-side source reported. In this build the source is a simulator, so every outcome is labelled as a simulation and none of them can become an authorised verification.",
    values: ["NOT_REQUESTED", "MOCK_MATCH", "MOCK_MISMATCH", "MOCK_ERROR", "REJECTED_BY_PORTAL"],
  },
  {
    dimension: "review",
    heading: "AICTE scrutiny",
    body: "The officer's administrative decision. It is separate from the bank-source result: a matching simulation does not accept a case, and an officer can accept a case while a difference remains, with reasons recorded.",
    values: ["QUEUED", "IN_REVIEW", "CLARIFICATION_REQUIRED", "ACCEPTED", "REJECTED"],
  },
  {
    dimension: "instrument",
    heading: "Instrument lifecycle",
    body: "Where the deposit itself stands. A replacement supersedes the predecessor without erasing it, and a recorded release is an administrative approval only.",
    values: ["REGISTERED", "ACTIVE", "SUPERSEDED", "RELEASE_RECORDED"],
  },
  {
    dimension: "lien",
    heading: "Lien",
    body: "Whether the deposit is marked in favour of AICTE. A declared or simulated lien is a claim; only an authorised source can confirm one.",
    values: ["UNKNOWN", "CLAIMED", "CONFIRMED", "DISPUTED"],
  },
];

export function HelpPage() {
  const { meta } = useSession();

  return (
    <>
      <PageHeader
        title="Help and process notes"
        description="How this portal treats evidence, what each status means, and the limits of this prototype."
      />

      <div className="space-y-5">
        <Card title="What this prototype is">
          <p className="text-sm text-ink">
            KoshSetu is a working prototype for problem statement{" "}
            <strong>{meta?.problem_statement_id ?? "SIH26265"}</strong> —{" "}
            {meta?.problem_statement_title ?? "Streamline of security deposit / FDR portal"},
            issued by {meta?.issuer ?? "AICTE"}.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
            <li>
              It demonstrates the full lifecycle: submission, document evidence, scrutiny, maturity
              monitoring, replacement linkage and a controlled release workflow.
            </li>
            <li>
              It keeps institution-entered values, document extraction and bank-source results
              visibly separate, because conflating them is how a wrong decision gets made.
            </li>
            <li>Every state change is written to an append-only audit trail with a reason.</li>
          </ul>
        </Card>

        <Card title="What this prototype does not do">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
            <li>
              <strong>It does not verify instruments with a bank.</strong> There is no authorised
              bank integration. Verification responses come from a simulator and are labelled as
              simulations everywhere, including in exports.
            </li>
            <li>
              <strong>It does not move money.</strong> An approved release request is an
              administrative decision. Any actual discharge or refund is separate evidence that
              this portal may never receive.
            </li>
            <li>
              <strong>It does not detect fraud.</strong> Findings are deterministic rule outcomes
              with their evidence attached. There is no score and no trained predictor, and a
              difference between two values is a difference, not an allegation.
            </li>
            <li>
              <strong>It is not an official AICTE system</strong> and carries no government
              accessibility, hosting or security certification. The clearance bodies and document
              checklists are configurable workflow steps that a policy owner must confirm.
            </li>
          </ul>
        </Card>

        <Card title="Status vocabulary">
          <p className="text-sm text-ink-muted">
            There is deliberately no single “FDR status”. Six independent dimensions are tracked,
            because a document that parsed cleanly, a simulation that matched and an officer who
            accepted the case are three different facts.
          </p>
          <div className="mt-4 space-y-4">
            {STATUS_EXPLAINERS.map((group) => (
              <div key={group.heading} className="rounded-lg border border-line p-3.5">
                <h3 className="font-semibold text-ink">{group.heading}</h3>
                <p className="mt-1 text-sm text-ink-muted">{group.body}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {group.values.map((value) => (
                    <StatusBadge key={value} dimension={group.dimension} value={value} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Accessibility">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
            <li>Every journey works from the keyboard; drag and drop is never required.</li>
            <li>Status meaning is carried by words and an icon, not colour alone.</li>
            <li>Charts are accompanied by the same figures as a table.</li>
            <li>Asynchronous steps announce their state to assistive technology.</li>
            <li>
              Amounts use Indian grouping with the rupee sign, and dates are written as
              “26 Oct 2026” so DD/MM order is never ambiguous.
            </li>
          </ul>
          <p className="mt-3 text-sm text-ink-muted">
            GIGW 3.0 and WCAG 2.2 AA are the targets this build was written against. Conformance is
            assessed by the competent owner and an independent audit, which this prototype does not
            claim to have.
          </p>
        </Card>
      </div>
    </>
  );
}
