// Data table.
//
// Sticky header and first column, right-aligned money, sortable headers that
// work from the keyboard, and an explicit reset when a filter hides everything.

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "./primitives";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  sticky?: boolean;
  width?: string;
  srOnlyHeader?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  caption,
  rowKey,
  emptyTitle = "No matching records",
  emptyDescription,
  onResetFilters,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  caption: string;
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  onResetFilters?: () => void;
  footer?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = column.sortValue!(left);
      const b = column.sortValue!(right);
      if (a === b) return 0;
      return a > b ? factor : -factor;
    });
  }, [rows, sort, columns]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          onResetFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-sm font-semibold text-brand underline"
            >
              Reset all filters
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-subtle/70">
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              const Icon = !isSorted ? ArrowUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={isSorted ? (sort?.direction === "asc" ? "ascending" : "descending") : "none"}
                  className={`${column.sticky ? "sticky left-0 z-10 bg-subtle" : ""} ${
                    column.align === "right" ? "text-right" : "text-left"
                  } whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold text-ink-muted`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-semibold"
                      onClick={() =>
                        setSort((current) =>
                          current?.key === column.key
                            ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
                            : { key: column.key, direction: "asc" },
                        )
                      }
                    >
                      <span className={column.srOnlyHeader ? "sr-only" : undefined}>{column.header}</span>
                      <Icon aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : (
                    <span className={column.srOnlyHeader ? "sr-only" : undefined}>{column.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line/70 last:border-0 hover:bg-subtle/50">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${column.sticky ? "sticky left-0 z-10 bg-surface" : ""} ${
                    column.align === "right" ? "text-right tabular" : "text-left"
                  } px-3 py-3 align-middle text-ink`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <div className="border-t border-line px-3 py-2 text-xs text-ink-muted">{footer}</div>}
    </div>
  );
}
