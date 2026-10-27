import { RefreshCw } from "lucide-react";
import { dateTime } from "../../lib/format";

export function Freshness({ updatedAt, refreshing, onRefresh }: { updatedAt: number; refreshing: boolean; onRefresh: () => void }) {
  return <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted" aria-live="polite">
    <span>{refreshing ? "Refreshing records…" : updatedAt ? `Updated ${dateTime(new Date(updatedAt).toISOString())}` : "Waiting for records"}</span>
    <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-1 text-brand disabled:opacity-50"><RefreshCw aria-hidden="true" className={`size-3 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
  </div>;
}
