// Query and mutation hooks.
//
// Caches are keyed precisely so a mutation invalidates exactly what it
// changed. Authoritative outcomes — approvals, clearances, financial status —
// are never optimistically updated; the server's response is the truth.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiFetch, newIdempotencyKey } from "./client";
import type {
  AuditEvent,
  FdrDetail,
  FdrListItem,
  Finding,
  Institution,
  MaturityItem,
  Notification,
  Overview,
  ReleasePolicy,
  ReleaseRequest,
  ReportTable,
  RuleCatalog,
  ScenarioCatalog,
  UploadFinalizeResult,
  UploadSession,
} from "./types";

export const keys = {
  overview: ["overview"] as const,
  fdrs: (filters: Record<string, unknown>) => ["fdrs", filters] as const,
  fdr: (id: string) => ["fdr", id] as const,
  maturities: (band: string) => ["maturities", band] as const,
  exceptions: (filters: Record<string, unknown>) => ["exceptions", filters] as const,
  releases: (filters: Record<string, unknown>) => ["releases", filters] as const,
  release: (id: string) => ["release", id] as const,
  releasePolicy: ["release-policy"] as const,
  notifications: (filters: Record<string, unknown>) => ["notifications", filters] as const,
  unreadCount: ["notifications", "unread"] as const,
  audit: (filters: Record<string, unknown>) => ["audit", filters] as const,
  auditIntegrity: ["audit", "integrity"] as const,
  rules: ["rules"] as const,
  scenarios: ["scenarios"] as const,
  institutions: ["institutions"] as const,
  report: (key: string) => ["report", key] as const,
};

export function useOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: () => apiFetch<Overview>("/overview") });
}

export interface FdrFilters extends Record<string, unknown> {
  q?: string;
  institution_id?: string;
  issuer_bank?: string;
  review_status?: string;
  submission_status?: string;
  instrument_status?: string;
  bank_verification_status?: string;
  maturity_band?: string;
  assigned_to_me?: boolean;
  limit?: number;
  offset?: number;
}

export function useFdrs(filters: FdrFilters = {}, options?: Partial<UseQueryOptions<FdrListItem[]>>) {
  return useQuery({
    queryKey: keys.fdrs(filters),
    queryFn: () => apiFetch<FdrListItem[]>("/fdrs", { query: filters as Record<string, string> }),
    ...options,
  });
}

export function useFdr(id: string | undefined) {
  return useQuery({
    queryKey: keys.fdr(id ?? ""),
    queryFn: () => apiFetch<FdrDetail>(`/fdrs/${id}`),
    enabled: Boolean(id),
  });
}

export function useInstitutions() {
  return useQuery({
    queryKey: keys.institutions,
    queryFn: () => apiFetch<Institution[]>("/institutions"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMaturities(band: string) {
  return useQuery({
    queryKey: keys.maturities(band),
    queryFn: () => apiFetch<MaturityItem[]>("/maturities", { query: { band } }),
  });
}

export function useExceptions(filters: { category?: string; severity?: string; status?: string }) {
  return useQuery({
    queryKey: keys.exceptions(filters),
    queryFn: () => apiFetch<Finding[]>("/exceptions", { query: filters }),
  });
}

export function useRuleCatalog() {
  return useQuery({
    queryKey: keys.rules,
    queryFn: () => apiFetch<RuleCatalog>("/rules"),
    staleTime: 30 * 60 * 1000,
  });
}

export function useScenarios(enabled: boolean) {
  return useQuery({
    queryKey: keys.scenarios,
    queryFn: () => apiFetch<ScenarioCatalog>("/verification/scenarios"),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
}

export function useReleaseRequests(filters: { status?: string; assigned_bureau?: string } = {}) {
  return useQuery({
    queryKey: keys.releases(filters),
    queryFn: () => apiFetch<ReleaseRequest[]>("/release-requests", { query: filters }),
  });
}

export function useReleaseRequest(id: string | undefined) {
  return useQuery({
    queryKey: keys.release(id ?? ""),
    queryFn: () => apiFetch<ReleaseRequest>(`/release-requests/${id}`),
    enabled: Boolean(id),
  });
}

export function useReleasePolicy() {
  return useQuery({
    queryKey: keys.releasePolicy,
    queryFn: () => apiFetch<ReleasePolicy>("/release-policy"),
    staleTime: 30 * 60 * 1000,
  });
}

export function useNotifications(filters: { category?: string; unread_only?: boolean } = {}) {
  return useQuery({
    queryKey: keys.notifications(filters),
    queryFn: () => apiFetch<Notification[]>("/notifications", { query: filters as Record<string, string> }),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => apiFetch<{ unread: number; action_required: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

export function useAuditEvents(filters: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.audit(filters),
    queryFn: () => apiFetch<AuditEvent[]>("/audit-events", { query: filters }),
  });
}

export function useAuditIntegrity(enabled: boolean) {
  return useQuery({
    queryKey: keys.auditIntegrity,
    queryFn: () =>
      apiFetch<{ verified: boolean; events_checked: number; first_divergence: string | null; note: string }>(
        "/audit-events/integrity",
      ),
    enabled,
  });
}

export function useReport(reportKey: string) {
  return useQuery({
    queryKey: keys.report(reportKey),
    queryFn: () => apiFetch<ReportTable>(`/reports/${reportKey}`),
  });
}

// --- mutations ---------------------------------------------------------------

function useInvalidateCase() {
  const queryClient = useQueryClient();
  return (fdrId?: string, releaseId?: string) => {
    if (fdrId) queryClient.invalidateQueries({ queryKey: keys.fdr(fdrId) });
    if (releaseId) queryClient.invalidateQueries({ queryKey: keys.release(releaseId) });
    queryClient.invalidateQueries({ queryKey: ["fdrs"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["exceptions"] });
    queryClient.invalidateQueries({ queryKey: ["maturities"] });
    queryClient.invalidateQueries({ queryKey: ["releases"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  };
}

export function useCreateDraft() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<FdrDetail>("/fdrs/drafts", { method: "POST", body }),
    onSuccess: (detail) => invalidate(detail.id),
  });
}

export function usePatchDraft(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<FdrDetail>(`/fdrs/${fdrId}/draft`, { method: "PATCH", body }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useCreateUploadSession() {
  return useMutation({
    mutationFn: (body: {
      fdr_id: string;
      filename: string;
      content_type: string;
      size_bytes: number;
      document_type?: string;
    }) => apiFetch<UploadSession>("/upload-sessions", { method: "POST", body }),
  });
}

export function useFinalizeUpload(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<UploadFinalizeResult>(`/upload-sessions/${sessionId}/finalize`, { method: "POST" }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useSubmitFdr(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: {
      attestation: boolean;
      corrections?: Record<string, string>;
      correction_reason?: string;
    }) =>
      apiFetch<FdrDetail>(`/fdrs/${fdrId}/submit`, {
        method: "POST",
        body,
        // The backend is idempotent on submit; the key protects a double click.
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useScrutiny(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: { decision: string; reason: string; expected_version?: number }) =>
      apiFetch<FdrDetail>(`/fdrs/${fdrId}/scrutiny`, { method: "POST", body }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useMockBankCheck(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: { scenario_id?: string; checks?: string[] }) =>
      apiFetch(`/fdrs/${fdrId}/mock-bank-check`, { method: "POST", body }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useReparse(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<UploadFinalizeResult>(`/fdrs/${fdrId}/documents/${documentId}/reparse`, {
        method: "POST",
      }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useCreateReplacement(fdrId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<FdrDetail>(`/fdrs/${fdrId}/replacements`, { method: "POST", body }),
    onSuccess: (detail) => invalidate(detail.id),
  });
}

export function useDisposeFinding(fdrId?: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason: string }) =>
      apiFetch<Finding>(`/findings/${id}/disposition`, { method: "POST", body: { status, reason } }),
    onSuccess: () => invalidate(fdrId),
  });
}

export function useCreateReleaseRequest() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (body: {
      fdr_id: string;
      basis_code: string;
      justification: string;
      document_ids: string[];
    }) => apiFetch<ReleaseRequest>("/release-requests", { method: "POST", body }),
    onSuccess: (request) => invalidate(request.fdr_id, request.id),
  });
}

export function useAttachReleaseDocument(requestId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: ({ documentId, documentType }: { documentId: string; documentType: string }) =>
      apiFetch<ReleaseRequest>(`/release-requests/${requestId}/documents/${documentId}`, {
        method: "POST",
        query: { document_type: documentType },
      }),
    onSuccess: (request) => invalidate(request.fdr_id, requestId),
  });
}

export function useDecideClearance(requestId: string) {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: ({
      bureauCode,
      outcome,
      reason,
      validUntil,
    }: {
      bureauCode: string;
      outcome: string;
      reason: string;
      validUntil?: string;
    }) =>
      apiFetch<ReleaseRequest>(
        `/release-requests/${requestId}/clearances/${bureauCode}/decide`,
        { method: "POST", body: { outcome, reason, valid_until: validUntil ?? null } },
      ),
    onSuccess: (request) => invalidate(request.fdr_id, requestId),
  });
}

export function useReleaseAction(requestId: string, action: "prepare" | "approve" | "reject") {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: ({ reason, expectedVersion }: { reason: string; expectedVersion: number }) =>
      apiFetch<ReleaseRequest>(`/release-requests/${requestId}/${action}`, {
        method: "POST",
        body: { reason, expected_version: expectedVersion },
        // A final decision must never be duplicated by a retry or a double click.
        idempotencyKey: action === "approve" ? newIdempotencyKey() : undefined,
      }),
    onSuccess: (request) => invalidate(request.fdr_id, requestId),
  });
}

export function useAcknowledgeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: "read" | "ack" }) =>
      apiFetch<Notification>(`/notifications/${id}/${mode}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRunMaturityScan() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ created: number; skipped_duplicates: number; instruments_scanned: number }>(
        "/ops/maturity-scan",
        { method: "POST" },
      ),
    onSuccess: () => invalidate(),
  });
}
