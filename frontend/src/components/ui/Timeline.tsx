// Read-only audit chronology: who, what, when, why, and the correlation id in
// the expandable detail. No credentials or full instrument numbers appear here,
// because the API redacts them before the event is written.

import { useState } from "react";

import type { AuditEvent } from "../../lib/api/types";
import { dateTime, titleCase } from "../../lib/format";
import { Badge } from "./primitives";

export function Timeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <TimelineItem key={event.id} event={event} />
      ))}
    </ol>
  );
}

function TimelineItem({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative border-l-2 border-line pl-4">
      <span
        aria-hidden="true"
        className={`absolute -left-[5px] top-1.5 size-2 rounded-full ${
          event.outcome === "DENY" ? "bg-danger" : "bg-brand"
        }`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-ink">{titleCase(event.action)}</p>
        {event.outcome === "DENY" && <Badge tone="danger">Denied</Badge>}
        <span className="text-xs text-ink-muted">{dateTime(event.occurred_at)}</span>
      </div>
      <p className="text-sm text-ink-muted">{event.actor_label}</p>
      {event.reason && <p className="mt-0.5 text-sm text-ink">{event.reason}</p>}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="mt-1 text-xs font-semibold text-brand underline"
      >
        {open ? "Hide technical detail" : "Show technical detail"}
      </button>

      {open && (
        <dl className="mt-2 space-y-1.5 rounded-lg bg-subtle p-3 text-xs">
          <div>
            <dt className="font-semibold text-ink-muted">Record</dt>
            <dd className="break-all text-ink">
              {event.aggregate_type} · {event.aggregate_id}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-muted">Before</dt>
            <dd className="break-all text-ink">{event.old_state_summary || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-muted">After</dt>
            <dd className="break-all text-ink">{event.new_state_summary || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-muted">Correlation / digest</dt>
            <dd className="break-all text-ink">
              {event.request_id ?? "—"} · {event.integrity_digest.slice(0, 16)}…
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}
