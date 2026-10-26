// Typed API client.
//
// The session lives in an HttpOnly cookie, so nothing here stores a token.
// Writes carry the CSRF double-submit header and, where the backend supports
// it, an idempotency key. Errors arrive in the standard envelope and are
// surfaced with their code so the UI can react to a version conflict or a
// permission denial instead of showing a generic failure.

const CSRF_COOKIE = "koshsetu_csrf";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string> = {},
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isVersionConflict(): boolean {
    return this.code === "CASE_VERSION_CONFLICT";
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, idempotencyKey, signal } = options;

  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET") {
    const csrf = readCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null ? payload.error : undefined;
    if (response.status === 401 && !path.startsWith("/auth/")) {
      // The session is gone or expired. The provider listens for this and
      // routes to sign-in rather than leaving a protected page in an error state.
      window.dispatchEvent(new CustomEvent("koshsetu:unauthenticated"));
    }
    throw new ApiError(
      response.status,
      error?.code ?? "ERROR",
      error?.message ?? "The request could not be completed.",
      error?.field_errors ?? {},
      error?.request_id ?? response.headers.get("x-request-id") ?? undefined,
    );
  }

  return payload as T;
}

/** Upload the object itself. The browser never sees a storage URL. */
export async function uploadObject(uploadUrl: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file, file.name);
  const csrf = readCsrfToken();

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: csrf ? { "X-CSRF-Token": csrf } : {},
    credentials: "same-origin",
    body: form,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "UPLOAD_FAILED",
      payload?.error?.message ?? "The file could not be uploaded.",
    );
  }
}

/** Fetch a document through a short-lived ticket and hand back a blob URL. */
export async function fetchDocumentBlob(fdrId: string, documentId: string): Promise<string> {
  const ticket = await apiFetch<{ ticket: string; url: string }>(
    `/fdrs/${fdrId}/documents/${documentId}/download-ticket`,
    { method: "POST" },
  );
  const response = await fetch(`/api/v1/documents/content?ticket=${encodeURIComponent(ticket.ticket)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(response.status, "DOCUMENT_UNAVAILABLE", "This document could not be opened.");
  }
  return URL.createObjectURL(await response.blob());
}
