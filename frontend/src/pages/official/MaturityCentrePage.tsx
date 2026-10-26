// Maturity centre. Bands are computed by the server from authoritative dates,
// and the next action comes from the versioned rule set — a date by itself is
// neither a release approval nor a mandatory renewal.

import { Link, useSearchParams } from "react-router-dom";

import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "../../components/ui/primitives";
import { useMaturities, useRunMaturityScan } from "../../lib/api/hooks";
import { longDate, money, relativeDays } from "../../lib/format";
import { useSession } from "../../lib/auth/session";

const BANDS = [
  { value: "7", label: "Within 7 days" },
  { value: "15", label: "Within 15 days" },
  { value: "30", label: "Within 30 days" },
  { value: "60", label: "Within 60 days" },
  { value: "90", label: "Within 90 days" },
  { value: "OVERDUE", label: "Overdue action" },
  { value: "MATURED", label: "All matured" },
];

export function MaturityCentrePage() {
  const [params, setParams] = useSearchParams();
  const band = params.get("band") ?? "30";
  const query = useMaturities(band);
  const scan = useRunMaturityScan();
  const { session, meta } = useSession();
  const isOfficial = session?.workspace !== "institution";
  const basePath = isOfficial ? "/official/fdrs" : "/institution/fdrs";

  return (
    <>
      <PageHeader
        title="Maturity centre"
        description="Deposits approaching or past maturity, with the action each one needs and who owns it."
        actions={
          session?.capabilities.includes("audit:read") ? (
            <Button
              variant="secondary"
              loading={scan.isPending}
              onClick={() => scan.mutate()}
              title="Runs the threshold scan now. Running it twice cannot create a duplicate reminder."
            >
              Run reminder scan
            </Button>
          ) : undefined
        }
      />

      {scan.data && (
        <Alert tone="info" className="mb-4" title="Reminder scan finished">
          {scan.data.created} new reminder{scan.data.created === 1 ? "" : "s"} queued ·{" "}
          {scan.data.skipped_duplicates} duplicate{scan.data.skipped_duplicates === 1 ? "" : "s"} skipped
          by the dedupe key · {scan.data.instruments_scanned} instruments scanned.
        </Alert>
      )}

      <div role="group" aria-label="Maturity window" className="mb-4 flex flex-wrap gap-2">
        {BANDS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={band === option.value}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("band", option.value);
              setParams(next, { replace: true });
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              band === option.value
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-muted hover:bg-subtle"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Loading maturities" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nothing in this window"
          description="Choose a wider window, or check the overdue band for unresolved actions."
        />
      ) : (
        <ul className="space-y-3">
          {query.data!.map((item) => (
            <li key={item.fdr.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`${basePath}/${item.fdr.id}`}
                      className="font-semibold text-brand-dark underline"
                    >
                      {item.fdr.fdr_number_masked}
                    </Link>
                    <StatusBadge dimension="attention" value={item.fdr.attention_level} />
                    {item.fdr.days_remaining < 0 && <Badge tone="danger">Overdue</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {item.fdr.institution_name} · {item.fdr.issuer_bank}
                  </p>
                </div>

                <div className="text-right">
                  <p className="tabular font-semibold text-ink">{money(item.fdr.principal_amount)}</p>
                  <p className="tabular text-sm text-ink-muted">{longDate(item.fdr.maturity_date)}</p>
                  <p
                    className={`text-sm font-semibold ${
                      item.fdr.days_remaining < 0
                        ? "text-danger"
                        : item.fdr.days_remaining <= 7
                          ? "text-warning"
                          : "text-ink-muted"
                    }`}
                  >
                    {relativeDays(item.fdr.days_remaining)}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-subtle p-3">
                <p className="text-sm">
                  <span className="font-semibold text-ink">Next action: </span>
                  <span className="text-ink-muted">{item.next_action}</span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Owner: {item.fdr.assigned_officer_id ? "assigned officer" : "unassigned"} ·{" "}
                  {item.reminders_sent} reminder{item.reminders_sent === 1 ? "" : "s"} on record
                  {item.predecessor_id ? " · has a predecessor instrument" : ""}
                  {item.successor_id ? " · replacement recorded" : ""}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge dimension="review" value={item.fdr.status.review_status} />
                <StatusBadge dimension="instrument" value={item.fdr.status.instrument_status} />
                {item.predecessor_id && (
                  <Link
                    to={`${basePath}/${item.predecessor_id}`}
                    className="text-sm font-semibold text-brand underline"
                  >
                    Open predecessor
                  </Link>
                )}
                {item.successor_id && (
                  <Link
                    to={`${basePath}/${item.successor_id}`}
                    className="text-sm font-semibold text-brand underline"
                  >
                    Open successor
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Reminders are generated from the database, not a cache, and each logical notice has a
        deterministic dedupe key. {meta?.is_simulated_environment ? "Bank-reported renewals in this build are simulated claims until an authorised source confirms them." : ""}
      </p>
    </>
  );
}
