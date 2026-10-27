import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api/client";
import { Alert, Card, ErrorState, LoadingBlock, PageHeader } from "../../components/ui/primitives";
import { DataTable } from "../../components/ui/table";
import { Freshness } from "../../components/ui/Freshness";

interface Analytics { as_of: string; completed_reviews: number; median_review_hours: number | null; groups: {region: string; bank: string; instruments: number; pending_review: number; maturing_90_days: number}[]; note: string }

export function AnalyticsPage() {
  const query = useQuery({ queryKey: ["analytics"], queryFn: () => apiFetch<Analytics>("/analytics/turnaround") });
  return <><PageHeader title="Turnaround analytics" description="Recorded scrutiny turnaround and the next 90 days of maturity exposure in your assigned scope." />
    <Freshness updatedAt={query.dataUpdatedAt} refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
    {query.isLoading ? <LoadingBlock /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : query.data && <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2"><Card title="Median time to first final review"><p className="tabular text-3xl font-semibold">{query.data.median_review_hours == null ? "No completed reviews" : `${query.data.median_review_hours} hours`}</p></Card><Card title="Completed reviews in sample"><p className="tabular text-3xl font-semibold">{query.data.completed_reviews}</p></Card></div>
      <Alert className="mb-5" tone="info">{query.data.note}</Alert>
      <Card title="Backlog by region and bank" bodyClassName=""><DataTable rows={query.data.groups} rowKey={row => `${row.region}:${row.bank}`} caption="Scoped backlog and maturity exposure" columns={[
        {key:"region",header:"Region",render:row=>row.region}, {key:"bank",header:"Bank",render:row=>row.bank}, {key:"total",header:"Instruments",align:"right",render:row=>row.instruments}, {key:"pending",header:"Pending review",align:"right",render:row=>row.pending_review}, {key:"maturity",header:"Maturing within 90 days",align:"right",render:row=>row.maturing_90_days},
      ]} /></Card>
    </>}
  </>;
}
