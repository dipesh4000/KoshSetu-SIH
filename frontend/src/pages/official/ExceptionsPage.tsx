// Integrity and action-needed queue.
//
// Deterministic findings grouped by what kind of problem they are. There is no
// fraud score; the rule that fired, the values it compared and the recommended
// next step are all on screen, and the rule catalogue is linked.

import { useState } from "react";
import { Link } from "react-router-dom";

import { FindingCard } from "../../components/fdr/FindingCard";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
} from "../../components/ui/primitives";
import { useDisposeFinding, useExceptions, useRuleCatalog } from "../../lib/api/hooks";
import { CATEGORY_LABELS } from "../../lib/format/status";
import { useSession } from "../../lib/auth/session";

const CATEGORY_ORDER = [
  "DATA_DISCREPANCY",
  "VERIFICATION_REQUIRED",
  "DEADLINE_RISK",
  "MISSING_EVIDENCE",
  "POLICY_HOLD",
  "DUPLICATE_CANDIDATE",
];

export function ExceptionsPage() {
  const { session } = useSession();
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("OPEN");

  const query = useExceptions({ category: category || undefined, severity: severity || undefined, status });
  const catalog = useRuleCatalog();
  const dispose = useDisposeFinding();

  const grouped = CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABELS[key] ?? key,
    findings: (query.data ?? []).filter((finding) => finding.category === key),
  })).filter((group) => group.findings.length > 0);

  return (
    <>
      <PageHeader
        title="Integrity & action needed"
        description="Every finding is a deterministic rule outcome with its evidence. Ranking exists to order work, not to allege fraud or financial culpability."
        meta={
          catalog.data ? (
            <>
              <span>
                Rule set {catalog.data.ruleset_name} v{catalog.data.version}
              </span>
              <span>Catalogue hash {catalog.data.sha256.slice(0, 12)}…</span>
              <Link to="/admin/rules" className="font-semibold text-brand underline">
                View the rule table
              </Link>
            </>
          ) : undefined
        }
      />

      <Card title="Filters" className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Finding class">
            {(props) => (
              <Select {...props} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All classes</option>
                {CATEGORY_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key] ?? key}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Severity">
            {(props) => (
              <Select {...props} value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">Any</option>
                <option value="BLOCKER">Blocker</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
              </Select>
            )}
          </Field>
          <Field label="Disposition">
            {(props) => (
              <Select {...props} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="FALSE_POSITIVE">False positive</option>
                <option value="ALL">All</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {query.isLoading ? (
        <LoadingBlock label="Loading findings" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No findings match this view"
          description="Widen the filters, or check the dispositions already recorded."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2.5 text-base font-semibold text-ink">
                {group.label}{" "}
                <span className="text-sm font-normal text-ink-muted">({group.findings.length})</span>
              </h2>
              <ul className="space-y-3">
                {group.findings.map((finding) => (
                  <li key={finding.id}>
                    <FindingCard
                      finding={finding}
                      showInstrument
                      disposing={dispose.isPending}
                      onDispose={
                        session?.capabilities.includes("finding:dispose")
                          ? (nextStatus, reason) =>
                              dispose.mutate({ id: finding.id, status: nextStatus, reason })
                          : undefined
                      }
                    />
                    <Link
                      to={`/official/fdrs/${finding.fdr_id}`}
                      className="mt-1 inline-block text-sm font-semibold text-brand underline"
                    >
                      Open the instrument and its evidence
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Alert tone="info" className="mt-6" title="How this queue is built">
        {catalog.data?.note ??
          "Findings are produced by versioned rules against the evidence on record. A finding is re-evaluated when evidence changes, and a disposition keeps its reason."}
      </Alert>
    </>
  );
}
