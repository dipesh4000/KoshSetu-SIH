// The institution's own release cases: where each one stands and what it is
// waiting on, in the institution's language.

import { Link } from "react-router-dom";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "../../components/ui/primitives";
import { useReleasePolicy, useReleaseRequests } from "../../lib/api/hooks";
import { dateTime, longDate, money } from "../../lib/format";

export function InstitutionReleasesPage() {
  const query = useReleaseRequests();
  const policy = useReleasePolicy();

  return (
    <>
      <PageHeader
        title="Release requests"
        description="Requests your institution has raised to release a security deposit, and what each one is waiting on."
      />

      <Alert tone="info" className="mb-5" title="What an approval means">
        An approved request records an administrative decision by the competent authority. It is
        not a confirmation that a bank has released or refunded the amount — that is separate
        evidence, which may reach you directly from the bank.
      </Alert>

      {query.isLoading ? (
        <LoadingBlock label="Loading your release requests" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No release requests yet"
          description="Open an accepted deposit and choose “Request release” to start a case."
        />
      ) : (
        <ul className="space-y-3">
          {query.data!.map((request) => (
            <li key={request.id}>
              <Card bodyClassName="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/institution/releases/${request.id}`}
                        className="font-semibold text-brand-dark underline"
                      >
                        Case {request.id.slice(0, 8)}
                      </Link>
                      <StatusBadge dimension="release" value={request.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {request.basis_label} · instrument {request.fdr_number_masked} · opened{" "}
                      {dateTime(request.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-semibold text-ink">{money(request.principal_amount)}</p>
                    <p className="tabular text-xs text-ink-muted">
                      Maturity {longDate(request.maturity_date)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Documents
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {request.checklist.map((item) => (
                        <li key={item.code} className="flex items-center gap-2 text-sm">
                          <Badge tone={item.satisfied ? "success" : "warning"}>
                            {item.satisfied ? "On record" : "Missing"}
                          </Badge>
                          <span className="min-w-0 truncate text-ink">{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Clearances
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {request.clearances.map((clearance) => (
                        <li key={clearance.id} className="flex items-center gap-2 text-sm">
                          <StatusBadge dimension="clearance" value={clearance.state} />
                          <span className="min-w-0 truncate text-ink">{clearance.bureau_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {request.hold_reason && (
                  <Alert tone="danger" className="mt-3" title="On hold">
                    {request.hold_reason}
                  </Alert>
                )}

                {request.blocking_reasons.length > 0 && !request.hold_reason && (
                  <div className="mt-3 rounded-lg bg-subtle p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Waiting on
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                      {request.blocking_reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {policy.data && (
        <p className="mt-4 text-xs text-ink-muted">
          Checklist {policy.data.checklist_name} v{policy.data.version}. {policy.data.note}
        </p>
      )}
    </>
  );
}
