// Register table shared by the institution and official views. The masked
// reference is the sticky identifier column; amounts are right-aligned and use
// tabular figures so they compare cleanly down the column.

import { Link } from "react-router-dom";

import type { FdrListItem } from "../../lib/api/types";
import { longDate, money, relativeDays } from "../../lib/format";
import { DataTable, type Column } from "../ui/table";
import { Badge, SimulationBadge, StatusBadge } from "../ui/primitives";

export function FdrTable({
  rows,
  basePath,
  showInstitution = true,
  onResetFilters,
  caption,
  footer,
}: {
  rows: FdrListItem[];
  basePath: string;
  showInstitution?: boolean;
  onResetFilters?: () => void;
  caption: string;
  footer?: React.ReactNode;
}) {
  const columns: Column<FdrListItem>[] = [
    {
      key: "reference",
      header: "Instrument",
      sticky: true,
      sortValue: (row) => row.fdr_number_masked,
      render: (row) => (
        <div className="min-w-0">
          <Link to={`${basePath}/${row.id}`} className="font-semibold text-brand-dark underline">
            {row.fdr_number_masked}
          </Link>
          <p className="truncate text-xs text-ink-muted">{row.issuer_bank}</p>
        </div>
      ),
    },
    ...(showInstitution
      ? [
          {
            key: "institution",
            header: "Institution",
            sortValue: (row: FdrListItem) => row.institution_name,
            render: (row: FdrListItem) => (
              <div className="min-w-0">
                <p className="truncate">{row.institution_name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {row.aicte_id} · {row.region_code}
                </p>
              </div>
            ),
          } satisfies Column<FdrListItem>,
        ]
      : []),
    {
      key: "principal",
      header: "Principal",
      align: "right",
      sortValue: (row) => Number(row.principal_amount),
      render: (row) => <span className="font-medium">{money(row.principal_amount)}</span>,
    },
    {
      key: "maturity",
      header: "Maturity",
      sortValue: (row) => row.maturity_date,
      render: (row) => (
        <div>
          <p className="tabular">{longDate(row.maturity_date)}</p>
          <p
            className={`text-xs ${
              row.days_remaining < 0
                ? "font-semibold text-danger"
                : row.is_maturing
                  ? "font-semibold text-warning"
                  : "text-ink-muted"
            }`}
          >
            {relativeDays(row.days_remaining)}
          </p>
        </div>
      ),
    },
    {
      key: "submission",
      header: "Submission",
      sortValue: (row) => row.status.submission_status,
      render: (row) => <StatusBadge dimension="submission" value={row.status.submission_status} />,
    },
    {
      key: "bank",
      header: "Bank-source check",
      sortValue: (row) => row.status.bank_verification_status,
      render: (row) => <SimulationBadge state={row.status.bank_verification_status} />,
    },
    {
      key: "review",
      header: "AICTE scrutiny",
      sortValue: (row) => row.status.review_status,
      render: (row) => <StatusBadge dimension="review" value={row.status.review_status} />,
    },
    {
      key: "attention",
      header: "Action needed",
      sortValue: (row) => row.open_finding_count,
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge dimension="attention" value={row.attention_level} />
          {row.open_finding_count > 0 && (
            <Badge tone="neutral">
              {row.open_finding_count} open finding{row.open_finding_count === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      onResetFilters={onResetFilters}
      emptyTitle="No deposits match this view"
      emptyDescription="Adjust or reset the filters to widen the search."
      footer={footer}
    />
  );
}
