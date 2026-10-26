// Institution home. Action required comes before totals, and the progress
// wording distinguishes "we received your file" from "an officer accepted it".

import { ArrowRight, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { FdrTable } from "../../components/fdr/FdrTable";
import { KpiCard } from "../../components/ui/KpiCard";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "../../components/ui/primitives";
import { useFdrs, useNotifications, useOverview } from "../../lib/api/hooks";
import { dateTime, longDate, relativeDays } from "../../lib/format";

export function InstitutionOverviewPage() {
  const overview = useOverview();
  const deposits = useFdrs({ limit: 100 });
  const actionRequired = useNotifications({ category: "ACTION_REQUIRED" });

  if (overview.isLoading || deposits.isLoading) return <LoadingBlock label="Loading your overview" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (!overview.data) return null;

  const data = overview.data;
  const rows = deposits.data ?? [];
  const nextDeadline = [...rows]
    .filter((row) => ["REGISTERED", "ACTIVE"].includes(row.status.instrument_status))
    .sort((left, right) => left.maturity_date.localeCompare(right.maturity_date))[0];
  const needsAttention = rows.filter(
    (row) =>
      row.status.submission_status === "CORRECTION_REQUESTED" ||
      row.status.document_processing_status === "REJECTED" ||
      row.attention_level !== "ROUTINE",
  );

  return (
    <>
      <PageHeader
        title="Institution overview"
        description="Your deposits, what we have received, and what is waiting on you."
        meta={<span>Calculated {dateTime(data.as_of)}</span>}
        actions={
          <Button
            variant="primary"
            icon={<Upload aria-hidden="true" className="size-4" />}
            onClick={() => {
              window.location.href = "/institution/fdrs/new";
            }}
          >
            New submission
          </Button>
        }
      />

      {(actionRequired.data?.length ?? 0) > 0 && (
        <div className="mb-5 space-y-2.5">
          {actionRequired.data!.slice(0, 3).map((notice) => (
            <Alert key={notice.id} tone="warning" title={notice.title}>
              <p>{notice.body}</p>
              <Link
                to="/institution/notifications"
                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold underline"
              >
                Open notifications
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis
          .filter((kpi) => kpi.key !== "pending_verification")
          .map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} asOf={data.as_of} linkBase="/institution/fdrs" />
          ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Next relevant deadline">
          {nextDeadline ? (
            <div>
              <p className="text-sm text-ink-muted">{nextDeadline.issuer_bank}</p>
              <p className="mt-0.5 text-lg font-semibold text-ink">{nextDeadline.fdr_number_masked}</p>
              <p className="tabular mt-2 text-sm text-ink">
                Matures {longDate(nextDeadline.maturity_date)}
              </p>
              <p
                className={`text-sm font-semibold ${
                  nextDeadline.days_remaining < 0
                    ? "text-danger"
                    : nextDeadline.days_remaining <= 30
                      ? "text-warning"
                      : "text-ink-muted"
                }`}
              >
                {relativeDays(nextDeadline.days_remaining)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge dimension="review" value={nextDeadline.status.review_status} />
                <StatusBadge dimension="instrument" value={nextDeadline.status.instrument_status} />
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Maturity alone is not a release approval. Record your intended renewal,
                replacement or release.
              </p>
              <Link
                to={`/institution/fdrs/${nextDeadline.id}`}
                className="mt-3 inline-block text-sm font-semibold text-brand underline"
              >
                Open this instrument
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No active instrument on record.</p>
          )}
        </Card>

        <Card
          title="Needs your attention"
          description="Corrections requested, rejected files and open findings on your deposits."
          bodyClassName=""
        >
          {needsAttention.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nothing is waiting on you"
                description="We will raise a notice here if an officer asks for a correction or a deadline approaches."
              />
            </div>
          ) : (
            <FdrTable
              rows={needsAttention}
              basePath="/institution/fdrs"
              showInstitution={false}
              caption="Your deposits that need attention"
            />
          )}
        </Card>
      </div>

      <Card
        className="mt-5"
        title="All your deposits"
        actions={
          <Link to="/institution/fdrs" className="text-sm font-semibold text-brand underline">
            Open the full register
          </Link>
        }
        bodyClassName=""
      >
        <FdrTable
          rows={rows.slice(0, 8)}
          basePath="/institution/fdrs"
          showInstitution={false}
          caption="Your submitted and draft deposits"
          footer={`Showing ${Math.min(8, rows.length)} of ${rows.length} instruments.`}
        />
      </Card>
    </>
  );
}
