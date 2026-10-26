// Official portfolio overview. Defaults to the assigned scope: a global figure
// would be an unauthorised aggregate for a regional officer.

import { Link } from "react-router-dom";

import { FdrTable } from "../../components/fdr/FdrTable";
import { KpiCard } from "../../components/ui/KpiCard";
import { Timeline } from "../../components/ui/Timeline";
import { BacklogBars, MaturityChart } from "../../components/ui/charts";
import {
  Alert,
  Card,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/primitives";
import { useOverview } from "../../lib/api/hooks";
import { dateTime } from "../../lib/format";

export function OfficialOverviewPage() {
  const overview = useOverview();

  if (overview.isLoading) return <LoadingBlock label="Loading portfolio overview" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (!overview.data) return null;

  const data = overview.data;

  return (
    <>
      <PageHeader
        title="Portfolio overview"
        description="Health of the deposits in your assigned scope, with the exceptions that need an owner."
        meta={
          <>
            <span className="rounded border border-line bg-subtle px-2 py-0.5 font-medium">
              Scope: {data.scope_label}
            </span>
            <span>Calculated {dateTime(data.as_of)}</span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} asOf={data.as_of} linkBase="/official/fdrs" />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card
          title="Maturities by month"
          description="Derived from maturity dates in your scope, not from a stored status."
        >
          <MaturityChart buckets={data.maturity_by_month} />
        </Card>

        <div className="space-y-5">
          <Card
            title="Scrutiny backlog by age"
            description="Submitted instruments whose review has not concluded."
          >
            {data.verification_backlog.every((bucket) => bucket.count === 0) ? (
              <p className="text-sm text-ink-muted">No instruments are waiting for review.</p>
            ) : (
              <BacklogBars buckets={data.verification_backlog} />
            )}
          </Card>

          {data.recent_activity.length > 0 && (
            <Card
              title="Recent recorded actions"
              actions={
                <Link to="/official/audit" className="text-sm font-semibold text-brand underline">
                  Open audit explorer
                </Link>
              }
            >
              <Timeline events={data.recent_activity.slice(0, 5)} />
            </Card>
          )}
        </div>
      </div>

      <Card
        className="mt-5"
        title="Action needed first"
        description="Ranked by rule findings for work priority. Ranking is not a finding of fraud or culpability."
        actions={
          <Link to="/official/exceptions" className="text-sm font-semibold text-brand underline">
            Open the integrity queue
          </Link>
        }
        bodyClassName=""
      >
        {data.action_needed.length === 0 ? (
          <div className="p-5">
            <Alert tone="success" title="No critical or high findings open in your scope">
              Newly submitted instruments and approaching maturities will appear here as their
              rules fire.
            </Alert>
          </div>
        ) : (
          <FdrTable
            rows={data.action_needed}
            basePath="/official/fdrs"
            caption="Instruments with open critical or high findings"
          />
        )}
      </Card>
    </>
  );
}
