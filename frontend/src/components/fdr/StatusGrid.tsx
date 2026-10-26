// Every status dimension, side by side. A single merged badge would hide the
// distinction between "the bank simulation matched" and "an officer accepted
// it", which is exactly the distinction that matters here.

import type { StatusBlock } from "../../lib/api/types";
import { DIMENSION_TITLES } from "../../lib/format/status";
import { SimulationBadge, StatusBadge } from "../ui/primitives";

export function StatusGrid({ status }: { status: StatusBlock }) {
  const entries: { dimension: Parameters<typeof StatusBadge>[0]["dimension"]; value: string }[] = [
    { dimension: "submission", value: status.submission_status },
    { dimension: "document", value: status.document_processing_status },
    { dimension: "review", value: status.review_status },
    { dimension: "instrument", value: status.instrument_status },
    { dimension: "lien", value: status.lien_status },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <div key={entry.dimension} className="rounded-lg border border-line bg-surface p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {DIMENSION_TITLES[entry.dimension]}
          </dt>
          <dd className="mt-1.5">
            <StatusBadge dimension={entry.dimension} value={entry.value} />
          </dd>
        </div>
      ))}
      <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-warning">
          {DIMENSION_TITLES.bank}
        </dt>
        <dd className="mt-1.5">
          <SimulationBadge state={status.bank_verification_status} />
        </dd>
      </div>
    </dl>
  );
}
