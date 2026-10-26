// A rule finding with its evidence, rule identity and recommended next step.
// There is no score: the rule that fired and the values it compared are shown.

import { useState } from "react";

import type { Finding } from "../../lib/api/types";
import { dateTime, fieldLabel } from "../../lib/format";
import { CATEGORY_LABELS } from "../../lib/format/status";
import { Button, StatusBadge, TextArea } from "../ui/primitives";
import { Field, Select } from "../ui/primitives";

export function FindingCard({
  finding,
  onDispose,
  disposing = false,
  showInstrument = false,
}: {
  finding: Finding;
  onDispose?: (status: string, reason: string) => void;
  disposing?: boolean;
  showInstrument?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("ACKNOWLEDGED");
  const [reason, setReason] = useState("");

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge dimension="severity" value={finding.severity} />
            <span className="rounded border border-line bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
              {finding.rule_id}
            </span>
            <span className="text-xs text-ink-muted">
              {CATEGORY_LABELS[finding.category] ?? finding.category}
            </span>
          </div>
          <h3 className="mt-1.5 font-semibold text-ink">{finding.title}</h3>
          {showInstrument && finding.fdr_number_masked && (
            <p className="text-xs text-ink-muted">
              {finding.institution_name} · {finding.fdr_number_masked}
            </p>
          )}
        </div>
        <StatusBadge dimension="finding" value={finding.status} />
      </div>

      <p className="mt-2 text-sm text-ink">{finding.explanation}</p>

      {Object.keys(finding.evidence).length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 rounded-lg bg-subtle p-3 text-sm sm:grid-cols-2">
          {Object.entries(finding.evidence).map(([key, value]) => (
            <div key={key} className="flex min-w-0 gap-2">
              <dt className="shrink-0 text-ink-muted">{fieldLabel(key)}:</dt>
              <dd className="tabular min-w-0 break-words font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 text-sm">
        <span className="font-semibold text-ink">Next step: </span>
        <span className="text-ink-muted">{finding.recommended_action}</span>
      </p>

      <p className="mt-2 text-xs text-ink-muted">
        Rule {finding.rule_version} · detected {dateTime(finding.detected_at)}
        {finding.disposition_reason ? ` · ${finding.disposition_reason}` : ""}
      </p>

      {onDispose && finding.status === "OPEN" && (
        <div className="mt-3 border-t border-line pt-3">
          {open ? (
            <div className="space-y-3">
              <Field label="Disposition">
                {(props) => (
                  <Select {...props} value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="ACKNOWLEDGED">Acknowledge — work in progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="FALSE_POSITIVE">Record as false positive</option>
                  </Select>
                )}
              </Field>
              <Field
                label="Reason"
                required
                hint="Recorded with your identity in the audit trail. The finding re-opens automatically if its evidence changes."
              >
                {(props) => (
                  <TextArea
                    {...props}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="What did you check, and what did you conclude?"
                  />
                )}
              </Field>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  loading={disposing}
                  disabled={reason.trim().length < 5}
                  onClick={() => onDispose(status, reason.trim())}
                >
                  Record disposition
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Record a disposition
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
