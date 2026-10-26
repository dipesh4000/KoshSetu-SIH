// Charts always ship with their numbers.
//
// Each chart is followed by an accessible table of the same values, because
// colour and bar length alone cannot carry maturity or backlog meaning.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";

import type { Bucket } from "../../lib/api/types";
import { money, moneyCompact } from "../../lib/format";

export function MaturityChart({
  buckets,
  onSelectMonth,
}: {
  buckets: Bucket[];
  onSelectMonth?: (month: string) => void;
}) {
  const [mode, setMode] = useState<"amount" | "count">("amount");
  const data = buckets.map((bucket) => ({
    label: bucket.label,
    amount: Number(bucket.amount),
    count: bucket.count,
  }));

  const peak = data.reduce(
    (best, row) => (row.amount > (best?.amount ?? -1) ? row : best),
    data[0],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {peak
            ? `Largest month by value: ${peak.label} (${money(peak.amount)} across ${peak.count} instrument${peak.count === 1 ? "" : "s"}).`
            : "No maturities in scope."}
        </p>
        <div role="group" aria-label="Chart measure" className="flex gap-1">
          {(["amount", "count"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                mode === option
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-muted"
              }`}
            >
              {option === "amount" ? "By value" : "By count"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-60" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid stroke="#e6eaf2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475467" }} interval={0} angle={-20} dy={10} height={46} />
            <YAxis
              tick={{ fontSize: 11, fill: "#475467" }}
              tickFormatter={(value: number) => (mode === "amount" ? moneyCompact(value) : String(value))}
              width={70}
            />
            <Tooltip
              formatter={(value: number) => (mode === "amount" ? money(value) : `${value} instruments`)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #d8dee8" }}
            />
            <Bar
              dataKey={mode}
              radius={[4, 4, 0, 0]}
              onClick={(entry: { label?: string }) => entry.label && onSelectMonth?.(entry.label)}
            >
              {data.map((row) => (
                <Cell key={row.label} fill="#2455c5" cursor={onSelectMonth ? "pointer" : "default"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-brand-dark">
          View the same data as a table
        </summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">Maturities by month, with value and instrument count</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <th scope="col" className="py-1.5">
                Month
              </th>
              <th scope="col" className="py-1.5 text-right">
                Instruments
              </th>
              <th scope="col" className="py-1.5 text-right">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label} className="border-b border-line/60 last:border-0">
                <td className="py-1.5">{row.label}</td>
                <td className="tabular py-1.5 text-right">{row.count}</td>
                <td className="tabular py-1.5 text-right">{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function BacklogBars({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <ul className="space-y-2.5">
      {buckets.map((bucket) => (
        <li key={bucket.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink">{bucket.label}</span>
            <span className="tabular font-semibold text-ink">{bucket.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-subtle">
            <div
              aria-hidden="true"
              className={`h-2 rounded-full ${
                bucket.label.startsWith("30+") ? "bg-danger" : bucket.label.startsWith("8-") ? "bg-warning" : "bg-brand"
              }`}
              style={{ width: `${Math.round((bucket.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
