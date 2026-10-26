// Operational view. Deliberately narrow: an administrator manages identities
// and settings, and has no right to change financial evidence or sign off a
// business case.

import { Link } from "react-router-dom";

import {
  Alert,
  Button,
  Card,
  DefinitionList,
  LoadingBlock,
  PageHeader,
} from "../../components/ui/primitives";
import { useAuditIntegrity, useOverview, useRunMaturityScan } from "../../lib/api/hooks";
import { useSession } from "../../lib/auth/session";
import { dateTime } from "../../lib/format";

export function AdminOverviewPage() {
  const { session, meta } = useSession();
  const overview = useOverview();
  const integrity = useAuditIntegrity(true);
  const scan = useRunMaturityScan();

  return (
    <>
      <PageHeader
        title="System health"
        description="Environment gates, scheduled work and audit integrity for this deployment."
      />

      <Alert tone="warning" className="mb-5" title="Administrator scope">
        This role manages identities, assignments and operational settings. It carries no right to
        alter financial evidence, record a scrutiny decision or approve a release.
      </Alert>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Environment">
          <DefinitionList
            columns={1}
            items={[
              { label: "Environment", value: meta?.environment ?? "—" },
              {
                label: "Bank provider",
                value: meta?.bank_provider ?? "—",
                help: "The simulator is blocked from starting in a production environment by a settings gate.",
              },
              {
                label: "Simulated evidence",
                value: meta?.is_simulated_environment ? "Yes — every bank result is a simulation" : "No",
              },
              { label: "Problem statement", value: meta?.problem_statement_id ?? "—" },
              { label: "Your roles", value: session?.roles.join(", ") ?? "—" },
            ]}
          />
        </Card>

        <Card
          title="Audit integrity"
          description="Digest chaining gives tamper evidence, not immutability."
        >
          {integrity.isLoading ? (
            <LoadingBlock label="Verifying the audit chain" />
          ) : integrity.data ? (
            <>
              <p
                className={`text-sm font-semibold ${
                  integrity.data.verified ? "text-success" : "text-danger"
                }`}
              >
                {integrity.data.verified
                  ? `Chain intact across ${integrity.data.events_checked} events`
                  : `Divergence detected at ${integrity.data.first_divergence}`}
              </p>
              <p className="mt-1.5 text-sm text-ink-muted">{integrity.data.note}</p>
              <Link
                to="/official/audit"
                className="mt-3 inline-block text-sm font-semibold text-brand underline"
              >
                Open the audit explorer
              </Link>
            </>
          ) : null}
        </Card>

        <Card
          title="Scheduled work"
          description="A deployment runs this on a scheduler; it is idempotent, so running it twice creates no duplicate notice."
        >
          <Button variant="secondary" loading={scan.isPending} onClick={() => scan.mutate()}>
            Run the maturity reminder scan
          </Button>
          {scan.data && (
            <p className="mt-3 text-sm text-ink">
              {scan.data.created} created · {scan.data.skipped_duplicates} duplicates skipped ·{" "}
              {scan.data.instruments_scanned} instruments scanned.
            </p>
          )}
        </Card>

        <Card title="Portfolio counters">
          {overview.isLoading ? (
            <LoadingBlock label="Loading counters" />
          ) : overview.data ? (
            <>
              <DefinitionList
                columns={1}
                items={overview.data.kpis.map((kpi) => ({
                  label: kpi.label,
                  value: kpi.unit === "INR" ? `₹ ${kpi.value}` : kpi.value,
                  help: kpi.inclusion_criteria,
                }))}
              />
              <p className="mt-3 text-xs text-ink-muted">
                Calculated {dateTime(overview.data.as_of)} · scope {overview.data.scope_label}
              </p>
            </>
          ) : null}
        </Card>
      </div>
    </>
  );
}
