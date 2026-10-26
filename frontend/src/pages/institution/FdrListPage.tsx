// The institution's own register. Scope comes from the session, so there is no
// institution filter to choose here.

import { Upload } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { FdrTable } from "../../components/fdr/FdrTable";
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  TextInput,
} from "../../components/ui/primitives";
import { useFdrs } from "../../lib/api/hooks";

export function InstitutionFdrListPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") ?? "",
    submission_status: params.get("submission_status") ?? "",
    maturity_band: params.get("maturity_band") ?? "",
    limit: 200,
  };
  const query = useFdrs(filters);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="My deposits"
        description="Every security deposit and FDR your institution has recorded here, with its current state."
        actions={
          <Link to="/institution/fdrs/new">
            <Button variant="primary" icon={<Upload aria-hidden="true" className="size-4" />}>
              New submission
            </Button>
          </Link>
        }
      />

      <Card title="Filters">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Search" hint="Masked reference or issuer bank">
            {(props) => (
              <TextInput
                {...props}
                type="search"
                defaultValue={filters.q}
                onBlur={(event) => setFilter("q", event.target.value)}
              />
            )}
          </Field>
          <Field label="Submission state">
            {(props) => (
              <Select
                {...props}
                value={filters.submission_status}
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
          <Field label="Maturity window">
            {(props) => (
              <Select
                {...props}
                value={filters.maturity_band}
                onChange={(event) => setFilter("maturity_band", event.target.value)}
              >
                <option value="">Any</option>
                <option value="30">Within 30 days</option>
                <option value="60">Within 60 days</option>
                <option value="90">Within 90 days</option>
                <option value="OVERDUE">Overdue</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <Card className="mt-5" bodyClassName="">
        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading your deposits" />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : (
          <FdrTable
            rows={query.data ?? []}
            basePath="/institution/fdrs"
            showInstitution={false}
            caption="Your institution's deposits"
            onResetFilters={() => setParams(new URLSearchParams(), { replace: true })}
            footer={`${query.data?.length ?? 0} instruments on record.`}
          />
        )}
      </Card>
    </>
  );
}
