// Audit explorer. Read-only by construction: an auditor is never offered a
// mutation control, and the event text is already redacted server-side.

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Timeline } from "../../components/ui/Timeline";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  TextInput,
} from "../../components/ui/primitives";
import { useAuditEvents, useAuditIntegrity } from "../../lib/api/hooks";

export function AuditExplorerPage() {
  const [params, setParams] = useSearchParams();
  const [checkIntegrity, setCheckIntegrity] = useState(false);

  const filters = {
    aggregate_id: params.get("aggregate_id") ?? "",
    aggregate_type: params.get("aggregate_type") ?? "",
    action: params.get("action") ?? "",
    actor: params.get("actor") ?? "",
    outcome: params.get("outcome") ?? "",
    date_from: params.get("date_from") ?? "",
    date_to: params.get("date_to") ?? "",
    limit: 150,
  };
  const query = useAuditEvents(
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")),
  );
  const integrity = useAuditIntegrity(checkIntegrity);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Audit explorer"
        description="Append-only record of what was done, by whom, when and why. Credentials, full instrument numbers and document contents are redacted before an event is written."
        actions={
          <Button variant="secondary" onClick={() => setCheckIntegrity(true)} loading={integrity.isFetching}>
            Verify the digest chain
          </Button>
        }
      />

      {integrity.data && (
        <Alert
          tone={integrity.data.verified ? "success" : "danger"}
          title={
            integrity.data.verified
              ? `Digest chain intact across ${integrity.data.events_checked} events`
              : "The digest chain does not reconcile"
          }
          className="mb-4"
        >
          <p>{integrity.data.note}</p>
          {integrity.data.first_divergence && (
            <p className="mt-1">First divergence at event {integrity.data.first_divergence}.</p>
          )}
        </Alert>
      )}

      <Card title="Filters" className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Record id" hint="Instrument, release case, document or finding id">
            {(props) => (
              <TextInput
                {...props}
                defaultValue={filters.aggregate_id}
                onBlur={(event) => setFilter("aggregate_id", event.target.value)}
              />
            )}
          </Field>
          <Field label="Record type">
            {(props) => (
              <Select
                {...props}
                value={filters.aggregate_type}
                onChange={(event) => setFilter("aggregate_type", event.target.value)}
              >
                <option value="">Any</option>
                <option value="fdr">Instrument</option>
                <option value="fdr_document">Document</option>
                <option value="release_request">Release request</option>
                <option value="clearance_requirement">Clearance</option>
                <option value="finding">Finding</option>
                <option value="user">User / session</option>
                <option value="report">Report export</option>
              </Select>
            )}
          </Field>
          <Field label="Action contains">
            {(props) => (
              <TextInput
                {...props}
                defaultValue={filters.action}
                placeholder="release.approved"
                onBlur={(event) => setFilter("action", event.target.value)}
              />
            )}
          </Field>
          <Field label="Actor contains">
            {(props) => (
              <TextInput
                {...props}
                defaultValue={filters.actor}
                placeholder="scrutiny@aicte.demo"
                onBlur={(event) => setFilter("actor", event.target.value)}
              />
            )}
          </Field>
          <Field label="Outcome">
            {(props) => (
              <Select
                {...props}
                value={filters.outcome}
                onChange={(event) => setFilter("outcome", event.target.value)}
              >
                <option value="">Any</option>
                <option value="ALLOW">Allowed</option>
                <option value="DENY">Denied</option>
              </Select>
            )}
          </Field>
          <Field label="From date">
            {(props) => (
              <TextInput
                {...props}
                type="date"
                defaultValue={filters.date_from}
                onChange={(event) => setFilter("date_from", event.target.value)}
              />
            )}
          </Field>
          <Field label="To date">
            {(props) => (
              <TextInput
                {...props}
                type="date"
                defaultValue={filters.date_to}
                onChange={(event) => setFilter("date_to", event.target.value)}
              />
            )}
          </Field>
        </div>
        <button
          type="button"
          onClick={() => setParams(new URLSearchParams(), { replace: true })}
          className="mt-3 text-xs font-semibold text-brand underline"
        >
          Reset all filters
        </button>
      </Card>

      <Card title={`Events${query.data ? ` (${query.data.length})` : ""}`}>
        {query.isLoading ? (
          <LoadingBlock label="Loading audit events" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : (query.data?.length ?? 0) === 0 ? (
          <EmptyState title="No events match these filters" />
        ) : (
          <Timeline events={query.data!} />
        )}
      </Card>
    </>
  );
}
