// Assigned work queue: what this officer must look at, oldest first.

import { Link, useSearchParams } from "react-router-dom";

import { FdrTable } from "../../components/fdr/FdrTable";
import {
  Card,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/primitives";
import { useFdrs } from "../../lib/api/hooks";

export function WorkQueuePage() {
  const [params, setParams] = useSearchParams();
  const onlyMine = params.get("mine") === "1";

  const queued = useFdrs({ submission_status: "SUBMITTED", review_status: "QUEUED", limit: 100 });
  const inReview = useFdrs({
    submission_status: "SUBMITTED",
    review_status: "IN_REVIEW",
    assigned_to_me: onlyMine || undefined,
    limit: 100,
  });
  const clarification = useFdrs({ review_status: "CLARIFICATION_REQUIRED", limit: 100 });

  const sections = [
    {
      key: "queued",
      title: "Ready for officer review",
      description: "Submitted and attested by the institution, not yet picked up.",
      query: queued,
    },
    {
      key: "in-review",
      title: "In review",
      description: "Cases a scrutiny officer has started.",
      query: inReview,
    },
    {
      key: "clarification",
      title: "Awaiting institution clarification",
      description: "A correction has been requested; the case waits on the institution.",
      query: clarification,
    },
  ];

  return (
    <>
      <PageHeader
        title="Work queue"
        description="Scrutiny work in your assigned region, grouped by what it is waiting on."
        actions={
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.checked) next.set("mine", "1");
                else next.delete("mine");
                setParams(next, { replace: true });
              }}
              className="size-4"
            />
            Only cases assigned to me
          </label>
        }
      />

      <div className="space-y-5">
        {sections.map((section) => (
          <Card
            key={section.key}
            title={`${section.title}${section.query.data ? ` (${section.query.data.length})` : ""}`}
            description={section.description}
            bodyClassName=""
          >
            {section.query.isLoading ? (
              <div className="p-5">
                <LoadingBlock label={`Loading ${section.title}`} />
              </div>
            ) : section.query.isError ? (
              <div className="p-5">
                <ErrorState error={section.query.error} onRetry={section.query.refetch} />
              </div>
            ) : (
              <FdrTable
                rows={section.query.data ?? []}
                basePath="/official/fdrs"
                caption={section.title}
              />
            )}
          </Card>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-muted">
        Looking for findings rather than cases?{" "}
        <Link to="/official/exceptions" className="font-semibold text-brand underline">
          Open the integrity and action-needed queue
        </Link>
        .
      </p>
    </>
  );
}
