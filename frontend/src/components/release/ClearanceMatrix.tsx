// Clearance matrix: each requirement with its issuing bureau, outcome, the
// officer who recorded it, when, and its validity. Nothing can be inferred
// from an empty row — pending is shown as pending.

import type { Clearance } from "../../lib/api/types";
import { dateTime, longDate } from "../../lib/format";
import { StatusBadge } from "../ui/primitives";

export function ClearanceMatrix({
  clearances,
  canDecide,
  onDecide,
}: {
  clearances: Clearance[];
  canDecide?: (bureauCode: string) => boolean;
  onDecide?: (bureauCode: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {clearances.map((clearance) => (
        <li key={clearance.id} className="rounded-lg border border-line bg-surface p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {clearance.bureau_name}{" "}
                <span className="text-xs font-normal text-ink-muted">({clearance.bureau_code})</span>
              </p>
              <p className="text-xs text-ink-muted">
                {clearance.required ? "Required by the applicable checklist" : "Optional"} ·
                requirement version {clearance.requirement_version}
              </p>
            </div>
            <StatusBadge dimension="clearance" value={clearance.state} />
          </div>

          {clearance.outcome ? (
            <div className="mt-2 rounded-lg bg-subtle p-2.5 text-sm">
              <p className="text-ink">{clearance.reason}</p>
              <p className="mt-1 text-xs text-ink-muted">
                Recorded by {clearance.decided_by} on {dateTime(clearance.decided_at)}
                {clearance.valid_until ? ` · valid until ${longDate(clearance.valid_until)}` : ""}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              No decision recorded. Final approval stays blocked while this is outstanding.
            </p>
          )}

          {canDecide?.(clearance.bureau_code) && onDecide && (
            <button
              type="button"
              onClick={() => onDecide(clearance.bureau_code)}
              className="mt-2 text-sm font-semibold text-brand underline"
            >
              Record this bureau's decision
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
