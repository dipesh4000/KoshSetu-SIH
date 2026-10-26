// Master register. Filters live in the URL so a view can be shared or
// bookmarked, and the server re-checks scope on every request.

import { useSearchParams } from "react-router-dom";

import { FdrTable } from "../../components/fdr/FdrTable";
import {
  Badge,
  Card,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  TextInput,
} from "../../components/ui/primitives";
import { useFdrs, useInstitutions } from "../../lib/api/hooks";

const FILTER_KEYS = [
  "q",
  "institution_id",
  "issuer_bank",
  "submission_status",
  "review_status",
  "bank_verification_status",
  "instrument_status",
  "maturity_band",
] as const;

export function OfficialFdrListPage() {
  const [params, setParams] = useSearchParams();
  const institutions = useInstitutions();

  const filters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]).filter(([, value]) => value !== ""),
  );
  const query = useFdrs({ ...filters, limit: 200 });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const activeChips = Object.entries(filters);

  return (
    <>
      <PageHeader
        title="Deposit register"
        description="Every instrument in your assigned scope. Searching never reveals a full instrument number — only the masked reference is stored for display."
      />

      <Card title="Filters" bodyClassName="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Search" hint="Institution name, AICTE id, masked reference or bank">
            {(props) => (
              <TextInput
                {...props}
                type="search"
                defaultValue={params.get("q") ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  window.clearTimeout((window as unknown as { __t?: number }).__t);
                  (window as unknown as { __t?: number }).__t = window.setTimeout(
                    () => setFilter("q", value),
                    350,
                  );
                }}
              />
            )}
          </Field>

          <Field label="Institution">
            {(props) => (
              <Select
                {...props}
                value={params.get("institution_id") ?? ""}
                onChange={(event) => setFilter("institution_id", event.target.value)}
              >
                <option value="">All in scope</option>
                {(institutions.data ?? []).map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="AICTE scrutiny">
            {(props) => (
              <Select
                {...props}
                value={params.get("review_status") ?? ""}
                onChange={(event) => setFilter("review_status", event.target.value)}
              >
                <option value="">Any</option>
                <option value="QUEUED">Ready for officer review</option>
                <option value="IN_REVIEW">In review</option>
                <option value="CLARIFICATION_REQUIRED">Clarification required</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            )}
          </Field>

          <Field label="Bank-source check">
            {(props) => (
              <Select
                {...props}
                value={params.get("bank_verification_status") ?? ""}
                onChange={(event) => setFilter("bank_verification_status", event.target.value)}
              >
                <option value="">Any</option>
                <option value="NOT_REQUESTED">Not run</option>
                <option value="MOCK_MATCH">Simulation matched</option>
                <option value="MOCK_MISMATCH">Simulation reported a difference</option>
                <option value="MOCK_ERROR">Simulation failed</option>
              </Select>
            )}
          </Field>

          <Field label="Instrument lifecycle">
            {(props) => (
              <Select
                {...props}
                value={params.get("instrument_status") ?? ""}
                onChange={(event) => setFilter("instrument_status", event.target.value)}
              >
                <option value="">Any</option>
                <option value="REGISTERED">Registered</option>
                <option value="ACTIVE">Active</option>
                <option value="SUPERSEDED">Superseded</option>
                <option value="RELEASE_RECORDED">Release approved</option>
              </Select>
            )}
          </Field>

          <Field label="Maturity window">
            {(props) => (
              <Select
                {...props}
                value={params.get("maturity_band") ?? ""}
                onChange={(event) => setFilter("maturity_band", event.target.value)}
              >
                <option value="">Any</option>
                <option value="7">Within 7 days</option>
                <option value="15">Within 15 days</option>
                <option value="30">Within 30 days</option>
                <option value="60">Within 60 days</option>
                <option value="90">Within 90 days</option>
                <option value="OVERDUE">Overdue</option>
              </Select>
            )}
          </Field>

          <Field label="Issuer bank">
            {(props) => (
              <TextInput
                {...props}
                defaultValue={params.get("issuer_bank") ?? ""}
                onBlur={(event) => setFilter("issuer_bank", event.target.value)}
                placeholder="e.g. State Bank of India"
              />
            )}
          </Field>

          <Field label="Submission state">
            {(props) => (
              <Select
                {...props}
                value={params.get("submission_status") ?? ""}
                onChange={(event) => setFilter("submission_status", event.target.value)}
              >
                <option value="">Any</option>
                <option value="DRAFT">Draft</option>
                <option value="UPLOADED">Document uploaded</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="CORRECTION_REQUESTED">Correction requested</option>
              </Select>
            )}
          </Field>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Applied scope
            </span>
            {activeChips.map(([key, value]) => (
              <Badge key={key} tone="info">
                {key.replace(/_/g, " ")}: {String(value)}
              </Badge>
            ))}
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="text-xs font-semibold text-brand underline"
            >
              Reset all
            </button>
          </div>
        )}
      </Card>

      <Card className="mt-5" bodyClassName="">
        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading the register" />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : (
          <FdrTable
            rows={query.data ?? []}
            basePath="/official/fdrs"
            caption="Deposit register for your assigned scope"
            onResetFilters={() => setParams(new URLSearchParams(), { replace: true })}
            footer={`${query.data?.length ?? 0} instruments listed. Results are paginated and scoped server-side.`}
          />
        )}
      </Card>
    </>
  );
}
