// Release centre: every case with its checklist position, pending clearance and
// who it is waiting on.

import { Link, useSearchParams } from "react-router-dom";

import {
  Badge,
  Card,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  StatusBadge,
} from "../../components/ui/primitives";
import { DataTable, type Column } from "../../components/ui/table";
import { useReleasePolicy, useReleaseRequests } from "../../lib/api/hooks";
import type { ReleaseRequest } from "../../lib/api/types";
import { longDate, money } from "../../lib/format";

export function ReleaseCentrePage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const query = useReleaseRequests({ status: status || undefined });
  const policy = useReleasePolicy();

  const columns: Column<ReleaseRequest>[] = [
    {
      key: "request",
      header: "Request",
      sticky: true,
      sortValue: (row) => row.created_at,
      render: (row) => (
        <div className="min-w-0">
          <Link to={`/official/releases/${row.id}`} className="font-semibold text-brand-dark underline">
            {row.id.slice(0, 8)}
          </Link>
          <p className="truncate text-xs text-ink-muted">{row.fdr_number_masked}</p>
        </div>
      ),
    },
    {
      key: "institution",
      header: "Institution",
      sortValue: (row) => row.institution_name,
      render: (row) => <span className="truncate">{row.institution_name}</span>,
    },
    {
      key: "basis",
      header: "Basis",
      sortValue: (row) => row.basis_code,
      render: (row) => <span className="truncate">{row.basis_label}</span>,
    },
    {
      key: "amount",
      header: "Principal",
      align: "right",
      sortValue: (row) => Number(row.principal_amount),
      render: (row) => money(row.principal_amount),
    },
    {
      key: "status",
      header: "Case status",
      sortValue: (row) => row.status,
      render: (row) => <StatusBadge dimension="release" value={row.status} />,
    },
    {
      key: "clearances",
      header: "Clearances",
      render: (row) => (
        <ul className="space-y-1">
          {row.clearances.map((clearance) => (
            <li key={clearance.id} className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-ink">{clearance.bureau_code}</span>
              <StatusBadge dimension="clearance" value={clearance.state} />
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: "blocking",
      header: "Waiting on",
      render: (row) =>
        row.blocking_reasons.length === 0 ? (
          <Badge tone="success">Ready for a decision</Badge>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
            {row.blocking_reasons.slice(0, 2).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
            {row.blocking_reasons.length > 2 && <li>+{row.blocking_reasons.length - 2} more</li>}
          </ul>
        ),
    },
    {
      key: "opened",
      header: "Opened",
      sortValue: (row) => row.created_at,
      render: (row) => <span className="tabular text-xs">{longDate(row.created_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Release centre"
        description="Administrative release cases. The portal records decisions and clearances; it does not move funds, and an approval is not a completed bank release."
        meta={
          policy.data ? (
            <span>
              Checklist {policy.data.checklist_name} v{policy.data.version} · effective{" "}
              {longDate(policy.data.effective_from)}
            </span>
          ) : undefined
        }
      />

      <Card title="Filters" className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Case status">
            {(props) => (
              <Select
                {...props}
                value={status}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  if (event.target.value) next.set("status", event.target.value);
                  else next.delete("status");
                  setParams(next, { replace: true });
                }}
              >
                <option value="">Any</option>
                <option value="REQUESTED">Requested</option>
                <option value="DOCUMENTS_PENDING">Documents pending</option>
                <option value="CLEARANCES_PENDING">Clearances pending</option>
                <option value="ON_HOLD">On hold</option>
                <option value="READY_FOR_DECISION">Ready for decision</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <Card bodyClassName="">
        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading release cases" />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : (
          <DataTable
            caption="Release cases in your scope"
            columns={columns}
            rows={query.data ?? []}
            rowKey={(row) => row.id}
            emptyTitle="No release cases match this view"
            onResetFilters={() => setParams(new URLSearchParams(), { replace: true })}
            footer={`${query.data?.length ?? 0} cases listed. ${policy.data?.note ?? ""}`}
          />
        )}
      </Card>
    </>
  );
}
