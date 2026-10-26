// Document library.
//
// Documents are listed with their checksum, version and scan verdict. There is
// no durable link: opening one issues a short-lived authorised ticket.

import { useState } from "react";
import { Link } from "react-router-dom";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/primitives";
import { fetchDocumentBlob } from "../../lib/api/client";
import { useFdr, useFdrs } from "../../lib/api/hooks";
import { bytes, longDate } from "../../lib/format";

export function InstitutionDocumentsPage() {
  const list = useFdrs({ limit: 200 });
  const [selectedFdr, setSelectedFdr] = useState<string | null>(null);
  const detail = useFdr(selectedFdr ?? undefined);
  const [openError, setOpenError] = useState<string | null>(null);

  const withDocuments = (list.data ?? []).filter(
    (row) => row.status.document_processing_status !== "NOT_UPLOADED",
  );

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every document version your institution has uploaded, with its checksum and scan verdict."
      />

      <Alert tone="info" className="mb-5" title="How documents are stored">
        Files are kept in private storage under generated keys — never your filename — and are
        scanned before anyone can view them. Opening one issues a link that expires in two minutes
        and is re-checked against your permissions each time it is used.
      </Alert>

      {openError && (
        <Alert tone="danger" className="mb-4" title="The document could not be opened">
          {openError}
        </Alert>
      )}

      {list.isLoading ? (
        <LoadingBlock label="Loading documents" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : withDocuments.length === 0 ? (
        <EmptyState
          title="No documents uploaded yet"
          description="Start a submission to upload an instrument document."
          action={
            <Link to="/institution/fdrs/new" className="font-semibold text-brand underline">
              Start a new submission
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.3fr]">
          <Card title="Instruments with documents" bodyClassName="p-2">
            <ul className="divide-y divide-line">
              {withDocuments.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={selectedFdr === row.id}
                    onClick={() => setSelectedFdr(row.id)}
                    className={`w-full rounded-lg p-3 text-left ${
                      selectedFdr === row.id ? "bg-brand/5" : "hover:bg-subtle"
                    }`}
                  >
                    <p className="font-semibold text-ink">{row.fdr_number_masked}</p>
                    <p className="text-xs text-ink-muted">
                      {row.issuer_bank} · matures {longDate(row.maturity_date)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title={detail.data ? `Versions for ${detail.data.fdr_number_masked}` : "Select an instrument"}
          >
            {!selectedFdr ? (
              <p className="text-sm text-ink-muted">
                Choose an instrument to see its document versions.
              </p>
            ) : detail.isLoading ? (
              <LoadingBlock label="Loading document versions" />
            ) : (
              <ul className="space-y-2.5">
                {(detail.data?.documents ?? []).map((document) => (
                  <li key={document.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {document.original_filename}{" "}
                          <span className="text-xs text-ink-muted">version {document.version}</span>
                        </p>
                        <p className="tabular text-xs text-ink-muted">
                          {bytes(document.size_bytes)} · uploaded {longDate(document.uploaded_at)}
                        </p>
                        <p className="tabular break-all text-xs text-ink-muted">
                          SHA-256 {document.sha256}
                        </p>
                      </div>
                      <Badge tone={document.scan_status === "CLEAN" ? "success" : "danger"}>
                        {document.scan_status === "CLEAN"
                          ? "Cleared by scanning"
                          : "Rejected by scanning"}
                      </Badge>
                    </div>
                    {document.scan_detail && (
                      <p className="mt-1.5 text-xs text-ink-muted">{document.scan_detail}</p>
                    )}
                    {document.is_viewable && (
                      <Button
                        variant="secondary"
                        className="mt-2"
                        onClick={async () => {
                          setOpenError(null);
                          try {
                            const url = await fetchDocumentBlob(selectedFdr, document.id);
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch {
                            setOpenError(
                              "This document could not be opened. Your access may have changed — reload and try again.",
                            );
                          }
                        }}
                      >
                        Open document
                      </Button>
                    )}
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
