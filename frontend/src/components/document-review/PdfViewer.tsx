// PDF evidence viewport.
//
// The file is fetched through a short-lived authorized ticket and rendered
// from a blob, so no durable object-storage URL ever reaches the browser. The
// highlight is driven by the page index and region the extractor recorded; if
// a region is missing, manual page navigation still works.

import { ChevronLeft, ChevronRight, Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { fetchDocumentBlob } from "../../lib/api/client";
import { Alert, Button } from "../ui/primitives";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface Highlight {
  pageIndex: number;
  bbox: number[] | null;
  label: string;
}

export function PdfViewer({
  fdrId,
  documentId,
  highlight,
  isViewable,
  scanDetail,
}: {
  fdrId: string;
  documentId: string | null;
  highlight: Highlight | null;
  isViewable: boolean;
  scanDetail?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Load the document whenever the authorized document changes.
  useEffect(() => {
    if (!documentId || !isViewable) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const url = await fetchDocumentBlob(fdrId, documentId);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrlRef.current = url;
        const loaded = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
        if (cancelled) return;
        documentRef.current = loaded;
        setPageCount(loaded.numPages);
        setPage(1);
      } catch {
        if (!cancelled) setError("This document could not be opened. Reload the page and retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      documentRef.current?.destroy();
      documentRef.current = null;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [fdrId, documentId, isViewable]);

  const renderPage = useCallback(
    async (pageNumber: number) => {
      const pdf = documentRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;
      const pdfPage = await pdf.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: zoom });
      const context = canvas.getContext("2d");
      if (!context) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await pdfPage.render({ canvasContext: context, viewport }).promise;
    },
    [zoom],
  );

  useEffect(() => {
    if (pageCount > 0) void renderPage(page);
  }, [page, pageCount, renderPage]);

  // Jump to the page a selected field came from.
  useEffect(() => {
    if (!highlight || pageCount === 0) return;
    const target = Math.min(Math.max(highlight.pageIndex + 1, 1), pageCount);
    setPage(target);
    setAnnouncement(
      highlight.bbox
        ? `${highlight.label} found on page ${target}, region highlighted.`
        : `${highlight.label}: no region recorded. Showing page ${target}.`,
    );
  }, [highlight, pageCount]);

  if (!documentId) {
    return (
      <Alert tone="info" title="No document on record">
        Upload the instrument document to review its evidence side by side.
      </Alert>
    );
  }

  if (!isViewable) {
    return (
      <Alert tone="warning" title="This document cannot be displayed">
        <p>
          The file has not passed security scanning, so it is not rendered here.
          {scanDetail ? ` Scanner note: ${scanDetail}` : ""}
        </p>
      </Alert>
    );
  }

  const showHighlight = highlight?.bbox && highlight.pageIndex + 1 === page;

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            icon={<ChevronLeft aria-hidden="true" className="size-4" />}
          >
            <span className="sr-only">Previous page</span>
          </Button>
          <span className="tabular px-1 text-sm text-ink-muted">
            Page {page} of {pageCount || "—"}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={pageCount === 0 || page >= pageCount}
            icon={<ChevronRight aria-hidden="true" className="size-4" />}
          >
            <span className="sr-only">Next page</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.2).toFixed(2))))}
            icon={<ZoomOut aria-hidden="true" className="size-4" />}
          >
            <span className="sr-only">Zoom out</span>
          </Button>
          <span className="tabular text-sm text-ink-muted">{Math.round(zoom * 100)}%</span>
          <Button
            variant="secondary"
            onClick={() => setZoom((current) => Math.min(2.4, Number((current + 0.2).toFixed(2))))}
            icon={<ZoomIn aria-hidden="true" className="size-4" />}
          >
            <span className="sr-only">Zoom in</span>
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const url = await fetchDocumentBlob(fdrId, documentId);
              window.open(url, "_blank", "noopener,noreferrer");
            }}
            icon={<Download aria-hidden="true" className="size-4" />}
          >
            Open
          </Button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div ref={containerRef} className="relative flex-1 overflow-auto bg-subtle p-3">
        {loading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Loading document…
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="relative mx-auto w-fit">
          <canvas ref={canvasRef} className="block rounded border border-line bg-white shadow-sm" />
          {showHighlight && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded border-2 border-warning bg-warning/15"
              style={{
                left: `${highlight!.bbox![0] * 100}%`,
                top: `${highlight!.bbox![1] * 100}%`,
                width: `${highlight!.bbox![2] * 100}%`,
                height: `${highlight!.bbox![3] * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
