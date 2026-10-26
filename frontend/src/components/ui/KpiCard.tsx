// A KPI always states what it counts and when it was calculated. An unlabelled
// large figure on a financial dashboard invites the wrong conclusion.

import { Info } from "lucide-react";
import { Link } from "react-router-dom";

import type { Kpi } from "../../lib/api/types";
import { dateTime, money } from "../../lib/format";

export function KpiCard({ kpi, asOf, linkBase }: { kpi: Kpi; asOf: string; linkBase?: string }) {
  const display = kpi.unit === "INR" ? money(kpi.value) : kpi.value;
  const query = new URLSearchParams(kpi.filter_hint).toString();

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">{kpi.label}</p>
        <span className="group relative">
          <Info aria-hidden="true" className="size-4 text-ink-muted" />
          <span className="sr-only">{kpi.inclusion_criteria}</span>
          <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-60 rounded-lg border border-line bg-surface p-2 text-xs text-ink shadow-md group-hover:block group-focus-within:block">
            {kpi.inclusion_criteria}
          </span>
        </span>
      </div>

      <p className="tabular mt-1.5 text-3xl font-semibold tracking-tight text-ink">{display}</p>
      <p className="mt-1 text-xs text-ink-muted">As of {dateTime(asOf)}</p>

      {linkBase && query && (
        <Link
          to={`${linkBase}?${query}`}
          className="mt-2 inline-block text-sm font-semibold text-brand underline"
        >
          Open this filter
        </Link>
      )}
    </div>
  );
}
