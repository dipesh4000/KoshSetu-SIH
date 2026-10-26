// Renewal and replacement chains. The predecessor's evidence stays
// inspectable: a replacement adds a record, it never rewrites one.

import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "../../components/ui/primitives";
import { useFdrs } from "../../lib/api/hooks";
import { longDate, money, relativeDays } from "../../lib/format";

export function RenewalsPage() {
  const query = useFdrs({ limit: 200 });

  const superseded = (query.data ?? []).filter(
    (row) => row.status.instrument_status === "SUPERSEDED",
  );
  const dueSoon = (query.data ?? []).filter(
    (row) =>
      ["REGISTERED", "ACTIVE"].includes(row.status.instrument_status) && row.days_remaining <= 60,
  );

  return (
    <>
      <PageHeader
        title="Renewal and replacement"
        description="Instruments you have replaced, and the ones approaching maturity where a renewal, replacement or release decision is needed."
      />

      <Alert tone="info" className="mb-5" title="How a replacement is recorded">
        Recording a replacement creates a successor instrument and links it to the predecessor. The
        earlier instrument keeps its own dates, amount, documents and verification history, and is
        marked superseded rather than edited.
      </Alert>

      {query.isLoading ? (
        <LoadingBlock label="Loading your instruments" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <div className="space-y-5">
          <Card
            title={`Approaching maturity (${dueSoon.length})`}
            description="Open an instrument to record a replacement or start a release request."
          >
            {dueSoon.length === 0 ? (
              <EmptyState title="Nothing matures in the next 60 days" />
            ) : (
              <ul className="space-y-2.5">
                {dueSoon.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/institution/fdrs/${row.id}`}
                        className="font-semibold text-brand-dark underline"
                      >
                        {row.fdr_number_masked}
                      </Link>
                      <p className="text-xs text-ink-muted">{row.issuer_bank}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-medium text-ink">
                        {money(row.principal_amount)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          row.days_remaining < 0
                            ? "text-danger"
                            : row.days_remaining <= 30
                              ? "text-warning"
                              : "text-ink-muted"
                        }`}
                      >
                        {longDate(row.maturity_date)} · {relativeDays(row.days_remaining)}
                      </p>
                    </div>
                    <StatusBadge dimension="review" value={row.status.review_status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={`Replaced instruments (${superseded.length})`}
            description="Both sides of each chain remain open for inspection."
          >
            {superseded.length === 0 ? (
              <EmptyState title="No replacements recorded yet" />
            ) : (
              <ul className="space-y-2.5">
                {superseded.map((row) => (
                  <li key={row.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link
                        to={`/institution/fdrs/${row.id}`}
                        className="font-semibold text-brand-dark underline"
                      >
                        {row.fdr_number_masked}
                      </Link>
                      <ArrowRight aria-hidden="true" className="size-4 text-ink-muted" />
                      <span className="text-ink-muted">
                        superseded — open the instrument to see its successor
                      </span>
                      <StatusBadge dimension="instrument" value={row.status.instrument_status} />
                    </div>
                    <p className="tabular mt-1 text-xs text-ink-muted">
                      {money(row.principal_amount)} · matured {longDate(row.maturity_date)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
