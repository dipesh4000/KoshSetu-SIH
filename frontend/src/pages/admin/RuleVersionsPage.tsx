// The rule table behind every finding, with its version and catalogue hash, so
// a past decision can be read against the rules that applied at the time.

import {
  Alert,
  Card,
  DefinitionList,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "../../components/ui/primitives";
import { DataTable, type Column } from "../../components/ui/table";
import { useReleasePolicy, useRuleCatalog } from "../../lib/api/hooks";
import { CATEGORY_LABELS } from "../../lib/format/status";
import { longDate } from "../../lib/format";

type Rule = {
  id: string;
  category: string;
  severity: string;
  authority: string;
  title: string;
  recommended_action: string;
};

const AUTHORITY_NOTE: Record<string, string> = {
  POLICY: "Policy-driven — a policy owner must confirm its applicability.",
  OPERATIONAL: "Operational — raised to order work, not to assert a legal position.",
  INDICATIVE: "Indicative — a candidate for manual investigation only.",
};

export function RuleVersionsPage() {
  const catalog = useRuleCatalog();
  const policy = useReleasePolicy();

  const columns: Column<Rule>[] = [
    {
      key: "id",
      header: "Rule",
      sticky: true,
      sortValue: (row) => row.id,
      render: (row) => <span className="font-semibold">{row.id}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      sortValue: (row) => row.severity,
      render: (row) => <StatusBadge dimension="severity" value={row.severity} />,
    },
    {
      key: "category",
      header: "Class",
      sortValue: (row) => row.category,
      render: (row) => CATEGORY_LABELS[row.category] ?? row.category,
    },
    {
      key: "title",
      header: "Condition",
      render: (row) => row.title,
    },
    {
      key: "authority",
      header: "Authority",
      sortValue: (row) => row.authority,
      render: (row) => (
        <span title={AUTHORITY_NOTE[row.authority]} className="text-xs font-medium">
          {row.authority.toLowerCase()}
        </span>
      ),
    },
    {
      key: "action",
      header: "Recommended action",
      render: (row) => <span className="text-ink-muted">{row.recommended_action}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Rule and policy versions"
        description="The versioned catalogues that produce findings and release checklists. The version and hash in force are recorded against every finding and every case."
      />

      {catalog.isLoading ? (
        <LoadingBlock label="Loading the rule catalogue" />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={catalog.refetch} />
      ) : catalog.data ? (
        <div className="space-y-5">
          <Card title="Integrity rule set">
            <DefinitionList
              items={[
                { label: "Rule set", value: catalog.data.ruleset_name },
                { label: "Version", value: catalog.data.version },
                { label: "Catalogue hash", value: catalog.data.sha256 },
                {
                  label: "Thresholds",
                  value: Object.entries(catalog.data.thresholds)
                    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
                    .join(" · "),
                },
              ]}
            />
            <Alert tone="info" className="mt-4">
              {catalog.data.note}
            </Alert>
          </Card>

          <Card bodyClassName="">
            <DataTable
              caption="Integrity rule catalogue"
              columns={columns}
              rows={catalog.data.rules}
              rowKey={(row) => row.id}
              footer={`${catalog.data.rules.length} rules. Editing the catalogue does not change findings already recorded against an earlier version.`}
            />
          </Card>

          {policy.data && (
            <Card
              title="Release checklist policy"
              description={policy.data.note}
            >
              <DefinitionList
                items={[
                  { label: "Checklist", value: policy.data.checklist_name },
                  { label: "Version", value: policy.data.version },
                  { label: "Effective from", value: longDate(policy.data.effective_from) },
                  { label: "Policy hash", value: policy.data.sha256 },
                ]}
              />
              <ul className="mt-4 space-y-3">
                {policy.data.bases.map((basis) => (
                  <li key={basis.code} className="rounded-lg border border-line p-3">
                    <p className="font-semibold text-ink">{basis.label}</p>
                    <p className="text-xs text-ink-muted">{basis.code}</p>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          Documents
                        </p>
                        <ul className="list-disc pl-5 text-sm text-ink">
                          {basis.required_documents.map((document) => (
                            <li key={document.code}>{document.label}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          Clearances
                        </p>
                        <ul className="list-disc pl-5 text-sm text-ink">
                          {basis.clearances.map((clearance) => (
                            <li key={clearance.code}>{clearance.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}
    </>
  );
}
