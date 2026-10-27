import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api/client";
import { Alert, Button, Card, ErrorState, PageHeader } from "../../components/ui/primitives";
import { DataTable } from "../../components/ui/table";
import { useQueryClient } from "@tanstack/react-query";

interface Preview { batch_id: string; valid_rows: number; total_rows: number; rows: { row: number; reference: string; bank: string; principal: string; errors: string[] }[] }

export function BulkImportPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<number | null>(null);
  const queryClient = useQueryClient();
  async function upload(file: File) {
    setBusy(true); setError(null); setPreview(null); setCreated(null);
    try { const body = new FormData(); body.append("file", file); setPreview(await apiFetch<Preview>("/imports/fdrs/preview", { method: "POST", body })); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true); setError(null);
    try { const result = await apiFetch<{created: number}>(`/imports/fdrs/${preview.batch_id}/commit`, {method: "POST"}); setCreated(result.created); setPreview(null); await queryClient.invalidateQueries({queryKey: ["fdrs"]}); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  return <>
    <PageHeader title="Import deposits" description="Upload a CSV or XLSX, review each row, then create drafts. Up to 500 rows and 2 MB per file. Evidence and institution attestation are still required." actions={<a className="text-sm text-brand underline" href="/api/v1/imports/fdrs/template" download>Download CSV template</a>} />
    <Card title="Choose a spreadsheet"><label className="block text-sm font-medium" htmlFor="bulk-file">CSV or XLSX file</label><input id="bulk-file" type="file" accept=".csv,.xlsx" disabled={busy} className="mt-2 block w-full text-sm" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /><p className="mt-2 text-xs text-ink-muted">Use ISO dates (YYYY-MM-DD). Store full FDR references as text to preserve leading zeros. Preview expires after 30 minutes.</p></Card>
    {busy && <p className="my-4 text-sm" role="status">Processing import…</p>}
    {error != null && <div className="my-4"><ErrorState error={error} /></div>}
    {created !== null && <Alert className="mt-4" tone="success" title={`${created} drafts created`}><Link to="/institution/fdrs" className="underline">Open your deposits to upload evidence and complete submission.</Link></Alert>}
    {preview && <Card className="mt-5" title={`${preview.valid_rows} valid of ${preview.total_rows} rows`} description="Rows with validation errors or duplicate candidates will be excluded." actions={<Button variant="primary" disabled={!preview.valid_rows} loading={busy} onClick={() => void commit()}>Create {preview.valid_rows} drafts</Button>} bodyClassName="">
      <DataTable caption="Import preview" rows={preview.rows} rowKey={row => String(row.row)} columns={[
        {key:"row",header:"Row",render: row => row.row}, {key:"reference",header:"Masked reference",render: row => row.reference}, {key:"bank",header:"Bank",render: row => row.bank}, {key:"principal",header:"Principal (INR)",align:"right",render: row => row.principal}, {key:"errors",header:"Validation",render: row => row.errors.length ? <span className="text-danger">{row.errors.join("; ")}</span> : <span className="text-success">Ready to import as draft</span>},
      ]} />
    </Card>}
  </>;
}
