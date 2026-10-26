// Evidence workbench.
//
// Desktop shows the document beside the data; below 1024px the two become
// tabs rather than shrinking both into illegible columns. Submitted claim,
// document extraction, bank-source result and the scrutiny decision are four
// separate readings, and a simulated response never upgrades the wording.

import { FlaskConical, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EvidencePanel } from "../../components/fdr/EvidencePanel";
import { FindingCard } from "../../components/fdr/FindingCard";
import { StatusGrid } from "../../components/fdr/StatusGrid";
import { PdfViewer, type Highlight } from "../../components/document-review/PdfViewer";
import { Dialog } from "../../components/ui/dialog";
import {
  Alert,
  Badge,
  Button,
  Card,
  DefinitionList,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  SimulationBadge,
  TextArea,
  TextInput,
} from "../../components/ui/primitives";
import { ApiError } from "../../lib/api/client";
import {
  useCreateReleaseRequest,
  useCreateReplacement,
  useDisposeFinding,
  useFdr,
  useMockBankCheck,
  useReleasePolicy,
  useReparse,
  useScrutiny,
  useScenarios,
} from "../../lib/api/hooks";
import type { EvidenceField } from "../../lib/api/types";
import { useSession } from "../../lib/auth/session";
import { bytes, dateTime, fieldLabel, longDate, money, relativeDays } from "../../lib/format";

type Tab = "fields" | "checks" | "findings" | "history" | "documents";

const SCRUTINY_ACTIONS: Record<string, { label: string; title: string; description: string; tone: "primary" | "secondary" | "danger" }> = {
  START_REVIEW: {
    label: "Start review",
    title: "Start review and assign this case to you",
    description: "The case is assigned to you and moves to in review.",
    tone: "secondary",
  },
  OBSERVE: {
    label: "Record observation",
    title: "Record an observation",
    description: "Adds a note to the case history without changing its state.",
    tone: "secondary",
  },
  REQUEST_CLARIFICATION: {
    label: "Request clarification",
    title: "Request a clarification from the institution",
    description:
      "The institution is notified and may submit a correction with a reason. The current version stays on record.",
    tone: "secondary",
  },
  ACCEPT: {
    label: "Accept scrutiny",
    title: "Record an administrative acceptance",
    description:
      "This records acceptance for the demo administrative workflow against the evidence on file, including simulated bank evidence. It is not a real-world authenticity assurance.",
    tone: "primary",
  },
  REJECT: {
    label: "Reject with reason",
    title: "Reject this submission",
    description: "The institution is notified. The instrument returns to registered.",
    tone: "danger",
  },
};

export function FdrDetailPage() {
  const { fdrId } = useParams<{ fdrId: string }>();
  const { session } = useSession();
  const query = useFdr(fdrId);
  const [tab, setTab] = useState<Tab>("fields");
  const [mobileView, setMobileView] = useState<"document" | "data">("data");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const [scrutinyAction, setScrutinyAction] = useState<string | null>(null);
  const [scrutinyReason, setScrutinyReason] = useState("");
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [scenario, setScenario] = useState("");
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const detail = query.data;
  const isOfficialView = session?.workspace !== "institution";
  const basePath = isOfficialView ? "/official/fdrs" : "/institution/fdrs";

  const scrutiny = useScrutiny(fdrId ?? "");
  const bankCheck = useMockBankCheck(fdrId ?? "");
  const reparse = useReparse(fdrId ?? "");
  const disposeFinding = useDisposeFinding(fdrId);
  const scenarios = useScenarios(Boolean(session?.capabilities.includes("verification:mock_bank")));

  const cleanDocuments = useMemo(
    () => (detail?.documents ?? []).filter((document) => document.is_viewable),
    [detail],
  );

  useEffect(() => {
    if (!activeDocumentId && cleanDocuments.length > 0) setActiveDocumentId(cleanDocuments[0].id);
  }, [cleanDocuments, activeDocumentId]);

  if (query.isLoading) return <LoadingBlock label="Loading case" />;
  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return (
        <Alert tone="danger" title="This record is not available to you">
          You do not have permission to view or change this record, or it does not exist. Contact
          your organisation administrator if you believe this is wrong.
        </Alert>
      );
    }
    return <ErrorState error={error} onRetry={query.refetch} />;
  }
  if (!detail) return null;

  const openFindings = detail.findings.filter((finding) => finding.status === "OPEN");
  const blockers = openFindings.filter((finding) =>
    ["BLOCKER", "CRITICAL"].includes(finding.severity),
  );
  const latestCheck = detail.verification_checks[0] ?? null;
  const can = (capability: string) => Boolean(session?.capabilities.includes(capability));
  const allows = (action: string) => detail.permitted_actions.includes(action);

  function onSelectField(field: EvidenceField) {
    setSelectedField(field.field);
    setHighlight({
      pageIndex: field.page_index ?? 0,
      bbox: field.bbox,
      label: fieldLabel(field.field),
    });
    setMobileView("document");
  }

  async function runScrutiny() {
    if (!scrutinyAction || !detail) return;
    setActionError(null);
    try {
      await scrutiny.mutateAsync({
        decision: scrutinyAction,
        reason: scrutinyReason.trim(),
        expected_version: detail.version,
      });
      setScrutinyAction(null);
      setScrutinyReason("");
    } catch (error) {
      if (error instanceof ApiError && error.isVersionConflict) {
        setConflict(true);
        setScrutinyAction(null);
      } else {
        setActionError(error instanceof ApiError ? error.message : "The action could not be recorded.");
      }
    }
  }

  const documentPanel = (
    <Card
      className="h-full"
      bodyClassName="p-0"
      title="Instrument document"
      description={
        cleanDocuments.length > 1
          ? `Version ${cleanDocuments.find((item) => item.id === activeDocumentId)?.version ?? 1} of ${cleanDocuments.length}`
          : undefined
      }
      actions={
        cleanDocuments.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <span>Version</span>
            <Select
              value={activeDocumentId ?? ""}
              onChange={(event) => setActiveDocumentId(event.target.value)}
              className="w-auto py-1 text-xs"
            >
              {cleanDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  v{document.version} · {longDate(document.uploaded_at)}
                </option>
              ))}
            </Select>
          </label>
        ) : undefined
      }
    >
      <PdfViewer
        fdrId={detail.id}
        documentId={activeDocumentId}
        highlight={highlight}
        isViewable={cleanDocuments.length > 0}
        scanDetail={detail.documents[0]?.scan_detail}
      />
    </Card>
  );

  const dataPanel = (
    <div className="space-y-4">
      <Card bodyClassName="p-4 sm:p-5">
        <StatusGrid status={detail.status} />
      </Card>

      <Card bodyClassName="p-0">
        <div role="tablist" aria-label="Case detail" className="flex flex-wrap gap-1 border-b border-line px-3 pt-2.5">
          {(
            [
              ["fields", "Fields"],
              ["checks", `Checks (${detail.verification_checks.length})`],
              ["findings", `Findings (${openFindings.length})`],
              ["documents", `Documents (${detail.documents.length})`],
              ["history", "History"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setTab(key)}
              className={`rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold ${
                tab === key
                  ? "border-brand text-brand-dark"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {tab === "fields" && (
            <div
              role="tabpanel"
              id="panel-fields"
              aria-labelledby="tab-fields"
              tabIndex={0}
            >
              <EvidencePanel
                fields={detail.evidence_fields}
                onSelectField={onSelectField}
                selectedField={selectedField}
              />
            </div>
          )}

          {tab === "checks" && (
            <div role="tabpanel" id="panel-checks" aria-labelledby="tab-checks" tabIndex={0}>
              <Alert tone="simulated" title="Bank verification in this build is simulated">
                Responses come from a fixture-driven simulator. A valid simulator signature
                authenticates the simulator only — never a bank or an instrument — and no simulated
                result bypasses officer review.
              </Alert>

              {detail.verification_checks.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">No bank-source check has been recorded.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {detail.verification_checks.map((check) => (
                    <li key={check.id} className="rounded-lg border border-line bg-surface p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="simulated">{check.source_kind}</Badge>
                            {check.scenario_id && <Badge tone="neutral">{check.scenario_id}</Badge>}
                            <Badge
                              tone={
                                check.result === "MOCK_MATCH"
                                  ? "success"
                                  : check.result === "REJECTED_BY_PORTAL"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {check.result.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-sm text-ink">{check.message}</p>
                        </div>
                        <span className="text-xs text-ink-muted">{dateTime(check.performed_at)}</span>
                      </div>

                      {Object.keys(check.match_results).length > 0 && (
                        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                          {Object.entries(check.match_results).map(([field, outcome]) => (
                            <div key={field}>
                              <dt className="text-xs text-ink-muted">{fieldLabel(field.toLowerCase())}</dt>
                              <dd
                                className={`font-medium ${
                                  outcome === "MATCH"
                                    ? "text-success"
                                    : outcome === "MISMATCH"
                                      ? "text-danger"
                                      : "text-ink-muted"
                                }`}
                              >
                                {outcome.toLowerCase()}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      <p className="mt-2 text-xs text-ink-muted">
                        {check.provenance_note}
                        {check.correlation_id ? ` · Correlation ${check.correlation_id}` : ""}
                        {check.lien_claim ? ` · Lien claim: ${check.lien_claim}` : ""}
                      </p>
                      {check.expires_at && (
                        <p className="text-xs text-ink-muted">
                          Evidence valid until {dateTime(check.expires_at)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "findings" && (
            <div role="tabpanel" id="panel-findings" aria-labelledby="tab-findings" tabIndex={0}>
              {detail.findings.length === 0 ? (
                <p className="text-sm text-ink-muted">No rule findings on this case.</p>
              ) : (
                <ul className="space-y-3">
                  {detail.findings.map((finding) => (
                    <li key={finding.id}>
                      <FindingCard
                        finding={finding}
                        disposing={disposeFinding.isPending}
                        onDispose={
                          can("finding:dispose")
                            ? (status, reason) =>
                                disposeFinding.mutate({ id: finding.id, status, reason })
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents" tabIndex={0}>
              <ul className="space-y-2.5">
                {detail.documents.map((document) => (
                  <li key={document.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {document.original_filename}{" "}
                          <span className="text-xs text-ink-muted">v{document.version}</span>
                        </p>
                        <p className="tabular text-xs text-ink-muted">
                          {bytes(document.size_bytes)} · SHA-256 {document.sha256.slice(0, 16)}…
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={document.scan_status === "CLEAN" ? "success" : "danger"}>
                          {document.scan_status === "CLEAN" ? "Cleared by scanning" : "Rejected by scanning"}
                        </Badge>
                        <Badge tone="neutral">{document.processing_status.replace(/_/g, " ").toLowerCase()}</Badge>
                      </div>
                    </div>
                    {document.scan_detail && (
                      <p className="mt-1.5 text-xs text-ink-muted">{document.scan_detail}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {document.is_viewable && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setActiveDocumentId(document.id);
                            setMobileView("document");
                          }}
                        >
                          Show in viewer
                        </Button>
                      )}
                      {can("document:reparse") && document.is_viewable && (
                        <Button
                          variant="ghost"
                          loading={reparse.isPending}
                          icon={<RefreshCw aria-hidden="true" className="size-4" />}
                          onClick={() => reparse.mutate(document.id)}
                        >
                          Re-run extraction
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
                {detail.documents.length === 0 && (
                  <li className="text-sm text-ink-muted">No document has been uploaded yet.</li>
                )}
              </ul>
            </div>
          )}

          {tab === "history" && (
            <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" tabIndex={0}>
              {detail.review_decisions.length === 0 && detail.links.length === 0 ? (
                <p className="text-sm text-ink-muted">No decisions or links recorded yet.</p>
              ) : (
                <div className="space-y-5">
                  {detail.review_decisions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Scrutiny decisions</h3>
                      <ol className="mt-2 space-y-2.5">
                        {detail.review_decisions.map((decision) => (
                          <li key={decision.id} className="rounded-lg border border-line p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge
                                tone={
                                  decision.decision === "ACCEPT"
                                    ? "success"
                                    : decision.decision === "REJECT"
                                      ? "danger"
                                      : "info"
                                }
                              >
                                {decision.decision.replace(/_/g, " ").toLowerCase()}
                              </Badge>
                              <span className="text-xs text-ink-muted">{dateTime(decision.created_at)}</span>
                            </div>
                            <p className="mt-1.5 text-sm text-ink">{decision.reason}</p>
                            <p className="text-xs text-ink-muted">{decision.actor_label}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {detail.links.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Replacement chain</h3>
                      <ul className="mt-2 space-y-2.5">
                        {detail.links.map((link) => (
                          <li key={link.id} className="rounded-lg border border-line p-3 text-sm">
                            <p className="font-medium text-ink">
                              {link.relationship_type === "RENEWAL" ? "Renewal" : "Replacement"} effective{" "}
                              {longDate(link.effective_date)}
                            </p>
                            <p className="mt-1 text-ink-muted">
                              Predecessor{" "}
                              <Link
                                to={`${basePath}/${link.predecessor_fdr_id}`}
                                className="font-medium text-brand underline"
                              >
                                {link.predecessor_masked}
                              </Link>{" "}
                              → successor{" "}
                              <Link
                                to={`${basePath}/${link.successor_fdr_id}`}
                                className="font-medium text-brand underline"
                              >
                                {link.successor_masked}
                              </Link>
                            </p>
                            {link.reason && <p className="mt-1 text-ink">{link.reason}</p>}
                            <p className="mt-1 text-xs text-ink-muted">
                              The predecessor keeps its own dates, amount, documents and check history.
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {can("audit:read") && (
                <Link
                  to={`/official/audit?aggregate_id=${detail.id}`}
                  className="mt-4 inline-block text-sm font-semibold text-brand underline"
                >
                  Open the full audit trail for this case
                </Link>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <>
      <PageHeader
        title={`Instrument ${detail.fdr_number_masked}`}
        description={`${detail.institution.name} · ${detail.institution.aicte_id} · ${detail.issuer_bank}${
          detail.branch ? `, ${detail.branch}` : ""
        }`}
        meta={
          <>
            <span className="tabular font-medium text-ink">{money(detail.principal_amount)}</span>
            <span>Matures {longDate(detail.maturity_date)}</span>
            <span
              className={
                detail.days_remaining < 0
                  ? "font-semibold text-danger"
                  : detail.days_remaining <= 30
                    ? "font-semibold text-warning"
                    : undefined
              }
            >
              {relativeDays(detail.days_remaining)}
            </span>
            <span>Version {detail.version}</span>
            <span>Updated {dateTime(detail.updated_at)}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {can("verification:mock_bank") && allows("RUN_BANK_SIMULATION") && (
              <Button
                variant="secondary"
                icon={<FlaskConical aria-hidden="true" className="size-4" />}
                onClick={() => setBankDialogOpen(true)}
              >
                Run bank simulation
              </Button>
            )}
            {allows("RECORD_REPLACEMENT") && (
              <Button variant="secondary" onClick={() => setReplacementOpen(true)}>
                Record replacement
              </Button>
            )}
            {allows("REQUEST_RELEASE") && (
              <Button variant="secondary" onClick={() => setReleaseOpen(true)}>
                Request release
              </Button>
            )}
            {detail.release_request_id && (
              <Link
                to={`${isOfficialView ? "/official" : "/institution"}/releases/${detail.release_request_id}`}
              >
                <Button variant="secondary">Open release case</Button>
              </Link>
            )}
            {Object.keys(SCRUTINY_ACTIONS)
              .filter((action) => allows(action))
              .map((action) => (
                <Button
                  key={action}
                  variant={SCRUTINY_ACTIONS[action].tone === "primary" ? "primary" : SCRUTINY_ACTIONS[action].tone === "danger" ? "danger" : "secondary"}
                  onClick={() => {
                    setScrutinyAction(action);
                    setScrutinyReason("");
                  }}
                >
                  {SCRUTINY_ACTIONS[action].label}
                </Button>
              ))}
          </div>
        }
      />

      {conflict && (
        <Alert tone="warning" title="This case changed since you opened it" className="mb-4">
          <p>Review the latest version before taking an action.</p>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => {
              setConflict(false);
              void query.refetch();
            }}
          >
            Load the latest version
          </Button>
        </Alert>
      )}

      {actionError && (
        <Alert tone="danger" title="The action was not recorded" className="mb-4">
          {actionError}
        </Alert>
      )}

      {blockers.length > 0 && (
        <Alert
          tone="danger"
          title={`${blockers.length} finding${blockers.length === 1 ? "" : "s"} need attention before a decision`}
          className="mb-4"
        >
          <ul className="list-disc space-y-0.5 pl-5">
            {blockers.map((finding) => (
              <li key={finding.id}>
                <span className="font-semibold">{finding.rule_id}</span> — {finding.title}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {latestCheck && latestCheck.result === "REJECTED_BY_PORTAL" && (
        <Alert tone="danger" title="A simulated bank response was rejected" className="mb-4">
          {latestCheck.message} No status was changed, and a security event was recorded.
        </Alert>
      )}

      <Card className="mb-4" title="Instrument record" bodyClassName="p-4 sm:p-5">
        <DefinitionList
          columns={3}
          items={[
            { label: "Masked reference", value: detail.fdr_number_masked, help: "The full reference is never displayed or logged." },
            { label: "Issuer bank", value: `${detail.issuer_bank}${detail.branch ? `, ${detail.branch}` : ""}` },
            { label: "IFSC", value: detail.ifsc ?? "—", help: "Format checked only." },
            { label: "Principal", value: money(detail.principal_amount) },
            { label: "Interest rate", value: detail.interest_rate ? `${detail.interest_rate}% p.a.` : "—" },
            { label: "Issue date", value: longDate(detail.issue_date) },
            { label: "Maturity date", value: longDate(detail.maturity_date) },
            { label: "Lien beneficiary", value: detail.lien_beneficiary ?? "Not recorded" },
            {
              label: "Bank-source check",
              value: <SimulationBadge state={detail.status.bank_verification_status} />,
            },
          ]}
        />
      </Card>

      <div
        role="tablist"
        aria-label="Switch between the document and the case data"
        className="mb-3 flex gap-1 lg:hidden"
      >
        {(["data", "document"] as const).map((view) => (
          <button
            key={view}
            role="tab"
            aria-selected={mobileView === view}
            onClick={() => setMobileView(view)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
              mobileView === view ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-muted"
            }`}
          >
            {view === "data" ? "Case data" : "Document"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,56fr)_minmax(0,44fr)]">
        <div className={mobileView === "document" ? "block" : "hidden lg:block"}>{documentPanel}</div>
        <div className={mobileView === "data" ? "block" : "hidden lg:block"}>{dataPanel}</div>
      </div>

      {/* --- scrutiny confirmation --- */}
      <Dialog
        open={Boolean(scrutinyAction)}
        title={scrutinyAction ? SCRUTINY_ACTIONS[scrutinyAction].title : ""}
        description={scrutinyAction ? SCRUTINY_ACTIONS[scrutinyAction].description : undefined}
        onClose={() => setScrutinyAction(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setScrutinyAction(null)}>
              Cancel
            </Button>
            <Button
              variant={scrutinyAction === "REJECT" ? "danger" : "primary"}
              loading={scrutiny.isPending}
              disabled={scrutinyReason.trim().length < 5}
              onClick={() => void runScrutiny()}
            >
              Record this decision
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DefinitionList
            columns={2}
            items={[
              { label: "Case", value: `${detail.fdr_number_masked} · ${detail.institution.name}` },
              { label: "Version you are acting on", value: String(detail.version) },
              { label: "Open findings", value: String(openFindings.length) },
              {
                label: "Bank-source evidence",
                value: <SimulationBadge state={detail.status.bank_verification_status} />,
              },
            ]}
          />

          {scrutinyAction === "ACCEPT" && blockers.length > 0 && (
            <Alert tone="warning" title="Open critical findings on this case">
              <ul className="list-disc space-y-0.5 pl-5">
                {blockers.map((finding) => (
                  <li key={finding.id}>
                    {finding.rule_id} — {finding.title}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Record why acceptance is still appropriate.</p>
            </Alert>
          )}

          <Field
            label="Reason / observations"
            required
            hint="Stored immutably with your identity, the case version and the time."
          >
            {(props) => (
              <TextArea
                {...props}
                rows={4}
                value={scrutinyReason}
                onChange={(event) => setScrutinyReason(event.target.value)}
                placeholder="What did you check, and what are you deciding?"
              />
            )}
          </Field>
        </div>
      </Dialog>

      {/* --- bank simulation --- */}
      <Dialog
        open={bankDialogOpen}
        title="Run a simulated bank verification"
        description="Demonstration control. The scenario selector exists only in this environment, is never offered to institutions, and a simulated outcome is not bank authentication."
        onClose={() => setBankDialogOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBankDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={bankCheck.isPending}
              onClick={async () => {
                setActionError(null);
                try {
                  await bankCheck.mutateAsync(scenario ? { scenario_id: scenario } : {});
                  setBankDialogOpen(false);
                  setTab("checks");
                } catch (error) {
                  setActionError(
                    error instanceof ApiError ? error.message : "The simulation could not be run.",
                  );
                }
              }}
            >
              Run simulation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="simulated" title={scenarios.data?.disclaimer ?? "Simulated provider"}>
            Each response is tagged MOCK_BANK, signed by the simulator and checked for replay. The
            portal rejects a tampered or reused response without changing any status.
          </Alert>

          <Field
            label="Scenario"
            hint="Leave as derived to let the fixture set choose deterministically from the instrument reference."
          >
            {(props) => (
              <Select {...props} value={scenario} onChange={(event) => setScenario(event.target.value)}>
                <option value="">Derived from the instrument (default)</option>
                {(scenarios.data?.scenarios ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} — {item.expected_outcome}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {scenario && (
            <p className="text-sm text-ink-muted">
              {scenarios.data?.scenarios.find((item) => item.id === scenario)?.description}
            </p>
          )}
        </div>
      </Dialog>

      <ReplacementDialog
        open={replacementOpen}
        onClose={() => setReplacementOpen(false)}
        fdrId={detail.id}
        defaults={{
          issuer_bank: detail.issuer_bank,
          branch: detail.branch ?? "",
          ifsc: detail.ifsc ?? "",
          lien_beneficiary: detail.lien_beneficiary ?? "",
          principal_amount: detail.principal_amount,
        }}
        basePath={basePath}
      />

      <ReleaseRequestDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        fdrId={detail.id}
        documents={detail.documents.filter((document) => document.is_viewable).map((document) => document.id)}
        isOfficialView={isOfficialView}
      />
    </>
  );
}

function ReplacementDialog({
  open,
  onClose,
  fdrId,
  defaults,
  basePath,
}: {
  open: boolean;
  onClose: () => void;
  fdrId: string;
  defaults: {
    issuer_bank: string;
    branch: string;
    ifsc: string;
    lien_beneficiary: string;
    principal_amount: string;
  };
  basePath: string;
}) {
  const create = useCreateReplacement(fdrId);
  const [form, setForm] = useState({
    fdr_number: "",
    principal_amount: defaults.principal_amount,
    issue_date: new Date().toISOString().slice(0, 10),
    maturity_date: "",
    interest_rate: "",
    reason: "",
    relationship_type: "REPLACEMENT",
    effective_date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      title="Record a replacement or renewal instrument"
      description="A successor record is created and linked. The predecessor keeps its original dates, amount, documents and check history — nothing is overwritten."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={
              form.fdr_number.trim().length < 4 ||
              !form.maturity_date ||
              form.reason.trim().length < 5
            }
            onClick={async () => {
              setError(null);
              try {
                const successor = await create.mutateAsync({
                  successor: {
                    issuer_bank: defaults.issuer_bank,
                    branch: defaults.branch || null,
                    ifsc: defaults.ifsc || null,
                    fdr_number: form.fdr_number.trim(),
                    principal_amount: Number(form.principal_amount).toFixed(2),
                    interest_rate: form.interest_rate ? Number(form.interest_rate).toFixed(2) : null,
                    issue_date: form.issue_date,
                    maturity_date: form.maturity_date,
                    lien_beneficiary: defaults.lien_beneficiary || null,
                  },
                  relationship_type: form.relationship_type,
                  effective_date: form.effective_date,
                  reason: form.reason.trim(),
                });
                onClose();
                window.location.href = `${basePath}/${successor.id}`;
              } catch (caught) {
                setError(
                  caught instanceof ApiError ? caught.message : "The replacement could not be recorded.",
                );
              }
            }}
          >
            Create and link the successor
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Relationship">
          {(props) => (
            <Select
              {...props}
              value={form.relationship_type}
              onChange={(event) => setForm({ ...form, relationship_type: event.target.value })}
            >
              <option value="REPLACEMENT">Replacement by a fresh instrument</option>
              <option value="RENEWAL">Renewal of the same instrument</option>
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Successor FDR number" required>
            {(props) => (
              <TextInput
                {...props}
                value={form.fdr_number}
                onChange={(event) => setForm({ ...form, fdr_number: event.target.value })}
              />
            )}
          </Field>
          <Field label="Principal amount (INR)" required>
            {(props) => (
              <TextInput
                {...props}
                type="number"
                step="0.01"
                className="tabular"
                value={form.principal_amount}
                onChange={(event) => setForm({ ...form, principal_amount: event.target.value })}
              />
            )}
          </Field>
          <Field label="Issue date" required>
            {(props) => (
              <TextInput
                {...props}
                type="date"
                value={form.issue_date}
                onChange={(event) => setForm({ ...form, issue_date: event.target.value })}
              />
            )}
          </Field>
          <Field label="Maturity date" required>
            {(props) => (
              <TextInput
                {...props}
                type="date"
                value={form.maturity_date}
                onChange={(event) => setForm({ ...form, maturity_date: event.target.value })}
              />
            )}
          </Field>
          <Field label="Interest rate (% p.a.)">
            {(props) => (
              <TextInput
                {...props}
                type="number"
                step="0.01"
                className="tabular"
                value={form.interest_rate}
                onChange={(event) => setForm({ ...form, interest_rate: event.target.value })}
              />
            )}
          </Field>
          <Field label="Effective date" required>
            {(props) => (
              <TextInput
                {...props}
                type="date"
                value={form.effective_date}
                onChange={(event) => setForm({ ...form, effective_date: event.target.value })}
              />
            )}
          </Field>
        </div>

        <Field label="Reason" required hint="Why is the instrument being replaced or renewed?">
          {(props) => (
            <TextArea
              {...props}
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          )}
        </Field>

        <Alert tone="info">
          The successor starts as a draft. Upload its document and submit it so an officer can
          scrutinise the new instrument.
        </Alert>
      </div>
    </Dialog>
  );
}

function ReleaseRequestDialog({
  open,
  onClose,
  fdrId,
  documents,
  isOfficialView,
}: {
  open: boolean;
  onClose: () => void;
  fdrId: string;
  documents: string[];
  isOfficialView: boolean;
}) {
  const policy = useReleasePolicy();
  const create = useCreateReleaseRequest();
  const [basis, setBasis] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = policy.data?.bases.find((item) => item.code === basis);

  return (
    <Dialog
      open={open}
      title="Request release of this security deposit"
      description="A release request is an administrative case. Approval records a decision; it does not move money or instruct a bank."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!basis || justification.trim().length < 10}
            onClick={async () => {
              setError(null);
              try {
                const request = await create.mutateAsync({
                  fdr_id: fdrId,
                  basis_code: basis,
                  justification: justification.trim(),
                  document_ids: documents,
                });
                onClose();
                window.location.href = `${isOfficialView ? "/official" : "/institution"}/releases/${request.id}`;
              } catch (caught) {
                setError(
                  caught instanceof ApiError ? caught.message : "The request could not be created.",
                );
              }
            }}
          >
            Create the release case
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Basis for the request" required>
          {(props) => (
            <Select {...props} value={basis} onChange={(event) => setBasis(event.target.value)}>
              <option value="">Select the applicable basis</option>
              {(policy.data?.bases ?? []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {selected && (
          <div className="rounded-lg border border-line bg-subtle/50 p-3 text-sm">
            <p className="font-semibold text-ink">This basis requires</p>
            <p className="mt-1 text-ink-muted">Documents:</p>
            <ul className="list-disc pl-5 text-ink">
              {selected.required_documents.map((document) => (
                <li key={document.code}>{document.label}</li>
              ))}
            </ul>
            <p className="mt-2 text-ink-muted">Clearances:</p>
            <ul className="list-disc pl-5 text-ink">
              {selected.clearances.map((clearance) => (
                <li key={clearance.code}>{clearance.name}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">{policy.data?.note}</p>
          </div>
        )}

        <Field label="Justification" required hint="At least a sentence explaining the request.">
          {(props) => (
            <TextArea
              {...props}
              rows={4}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
