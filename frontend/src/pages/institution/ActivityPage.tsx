// Institution-visible activity: submissions, decisions on the institution's
// own cases and the notices it received. Internal official notes stay hidden.

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/primitives";
import { useFdrs, useNotifications } from "../../lib/api/hooks";
import { dateTime, longDate } from "../../lib/format";

export function InstitutionActivityPage() {
  const deposits = useFdrs({ limit: 200 });
  const notices = useNotifications({});

  const events = [
    ...(deposits.data ?? []).map((row) => ({
      id: `fdr-${row.id}`,
      when: row.updated_at,
      title: `${row.fdr_number_masked} — ${row.status.submission_status.replace(/_/g, " ").toLowerCase()}`,
      detail: `${row.issuer_bank} · scrutiny: ${row.status.review_status
        .replace(/_/g, " ")
        .toLowerCase()} · matures ${longDate(row.maturity_date)}`,
      kind: "Instrument",
    })),
    ...(notices.data ?? []).map((notice) => ({
      id: `notice-${notice.id}`,
      when: notice.created_at,
      title: notice.title,
      detail: notice.body,
      kind: "Notice",
    })),
  ].sort((left, right) => right.when.localeCompare(left.when));

  return (
    <>
      <PageHeader
        title="Activity"
        description="What has happened on your institution's cases, newest first."
      />

      <Alert tone="info" className="mb-5" title="What you can see here">
        This view shows your own submissions and the official actions recorded against them.
        Internal notes between officials are not shown.
      </Alert>

      {deposits.isLoading || notices.isLoading ? (
        <LoadingBlock label="Loading activity" />
      ) : deposits.isError ? (
        <ErrorState error={deposits.error} onRetry={deposits.refetch} />
      ) : events.length === 0 ? (
        <EmptyState title="No activity recorded yet" />
      ) : (
        <Card bodyClassName="p-4 sm:p-5">
          <ol className="space-y-3">
            {events.slice(0, 60).map((event) => (
              <li key={event.id} className="border-l-2 border-line pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={event.kind === "Notice" ? "warning" : "info"}>{event.kind}</Badge>
                  <p className="font-medium text-ink">{event.title}</p>
                  <span className="text-xs text-ink-muted">{dateTime(event.when)}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{event.detail}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}
