// Reports. Each run shows its scope, run id and provenance watermark, and the
// export is authorised again server-side before a row is written.

import { Download } from "lucide-react";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/primitives";
import { DataTable, type Column } from "../../components/ui/table";
import { useReport } from "../../lib/api/hooks";
import { useSession } from "../../lib/auth/session";
import { dateTime } from "../../lib/format";

const REPORTS = [
  {
    key: "active-exposure",
    title: "Active exposure by status",
    description: "Every instrument in scope with its principal, maturity and separate status dimensions.",
  },
  {
    key: "upcoming-maturities",
    title: "Upcoming maturities (90 days)",
    description: "Server-derived due windows with the days remaining and the current owner.",
  },
  {
    key: "unresolved-findings",
    title: "Unresolved findings",
    description: "Open rule findings with their severity, class and the instrument they belong to.",
  },
  {
    key: "clearance-backlog",
    title: "Clearance backlog",
    description: "Release cases with a bureau clearance that is not yet affirmative.",
  },
];

export function ReportsPage() {
  const { session } = useSession();
  const [active, setActive] = useState(REPORTS[0].key);
  const query = useReport(active);
  const canExport = session?.capabilities.includes("report:export");

  const columns: Column<string[]>[] =
    query.data?.columns.map((header, index) => ({
      key: `${header}-${index}`,
      header,
      align: /principal|value|amount|remaining|instruments/i.test(header) ? "right" : "left",
      sticky: index === 0,
      render: (row) => <span className={index === 0 ? "font-medium" : undefined}>{row[index]}</span>,
      sortValue: (row) => row[index] ?? "",
    })) ?? [];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Reproducible cuts of the records in your authorised scope. Every export is logged with who ran it and what it covered."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((report) => (
          <button
            key={report.key}
            type="button"
            aria-pressed={active === report.key}
            onClick={() => setActive(report.key)}
            className={`rounded-lg border p-3.5 text-left ${
              active === report.key ? "border-brand bg-brand/5" : "border-line bg-surface hover:bg-subtle"
            }`}
          >
            <p className="font-semibold text-ink">{report.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{report.description}</p>
          </button>
        ))}
      </div>

      <Card
        title={REPORTS.find((report) => report.key === active)?.title}
        description={
          query.data
            ? `Scope: ${query.data.scope_label} · generated ${dateTime(query.data.generated_at)} · run ${query.data.report_run_id}`
            : undefined
        }
        actions={
          canExport ? (
            <Button
              variant="secondary"
              icon={<Download aria-hidden="true" className="size-4" />}
              onClick={() => {
                window.location.href = `/api/v1/reports/${active}/export`;
              }}
            >
              Export CSV
            </Button>
          ) : undefined
        }
        bodyClassName=""
      >
        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Running report" />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : (
          <>
            <div className="px-4 pt-4 sm:px-5">
              <Alert tone="simulated" title={query.data?.watermark}>
                Exported copies carry this provenance line. Treat them as sensitive: they are not
                redacted beyond what your scope already allows.
              </Alert>
            </div>
            <div className="mt-4">
              <DataTable
                caption={REPORTS.find((report) => report.key === active)?.title ?? "Report"}
                columns={columns}
                rows={query.data?.rows ?? []}
                rowKey={(row) => row.join("|")}
                emptyTitle="This report has no rows in your scope"
                footer={`${query.data?.rows.length ?? 0} rows.${canExport ? "" : " Your roles do not include export permission."}`}
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
