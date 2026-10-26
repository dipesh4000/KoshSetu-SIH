// Release case detail.
//
// Prepare, review and final approval are separated, every prerequisite is
// listed with its current state, and the approve control stays disabled while
// anything blocks it — with the reasons visible rather than hidden.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ClearanceMatrix } from "../../components/release/ClearanceMatrix";
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
  StatusBadge,
  TextArea,
  TextInput,
} from "../../components/ui/primitives";
import { ApiError } from "../../lib/api/client";
import {
  useDecideClearance,
  useReleaseAction,
  useReleaseRequest,
} from "../../lib/api/hooks";
import { useSession } from "../../lib/auth/session";
import { dateTime, longDate, money } from "../../lib/format";

export function ReleaseCasePage() {
  const { requestId } = useParams<{ requestId: string }>();
  const { session } = useSession();
  const query = useReleaseRequest(requestId);

  const [clearanceBureau, setClearanceBureau] = useState<string | null>(null);
  const [clearanceOutcome, setClearanceOutcome] = useState("CLEARED");
  const [clearanceReason, setClearanceReason] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [decision, setDecision] = useState<"prepare" | "approve" | "reject" | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = useDecideClearance(requestId ?? "");
  const prepare = useReleaseAction(requestId ?? "", "prepare");
  const approve = useReleaseAction(requestId ?? "", "approve");
  const reject = useReleaseAction(requestId ?? "", "reject");

  if (query.isLoading) return <LoadingBlock label="Loading release case" />;
  if (query.isError) {
    const caught = query.error;
    if (caught instanceof ApiError && (caught.status === 403 || caught.status === 404)) {
      return (
        <Alert tone="danger" title="This case is not available to you">
          You do not have permission to view or change this record.
        </Alert>
      );
    }
    return <ErrorState error={caught} onRetry={query.refetch} />;
  }
  if (!query.data) return null;

  const request = query.data;
  const isOfficial = session?.workspace !== "institution";
  const can = (capability: string) => Boolean(session?.capabilities.includes(capability));
  const isDecided = ["APPROVED", "REJECTED", "CLOSED"].includes(request.status);

  const mutation = decision === "prepare" ? prepare : decision === "approve" ? approve : reject;

  async function runDecision() {
    if (!decision) return;
    setError(null);
    try {
      await mutation.mutateAsync({ reason: decisionReason.trim(), expectedVersion: request.version });
      setDecision(null);
      setDecisionReason("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The decision could not be recorded.");
    }
  }

  return (
    <>
      <PageHeader
        title={`Release case ${request.id.slice(0, 8)}`}
        description={`${request.institution_name} · instrument ${request.fdr_number_masked} · ${request.basis_label}`}
        meta={
          <>
            <span className="tabular font-medium text-ink">{money(request.principal_amount)}</span>
            <span>Matured / matures {longDate(request.maturity_date)}</span>
            <span>Opened {dateTime(request.created_at)}</span>
            <span>Version {request.version}</span>
            <span>Policy {request.policy_version}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${isOfficial ? "/official" : "/institution"}/fdrs/${request.fdr_id}`}>
              <Button variant="secondary">Open the instrument</Button>
            </Link>
            {can("release:prepare") && !isDecided && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDecision("prepare");
                  setDecisionReason("");
                }}
              >
                Record case preparation
              </Button>
            )}
            {can("release:approve") && !isDecided && (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDecision("reject");
                    setDecisionReason("");
                  }}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  disabled={!request.can_finally_approve}
                  title={
                    request.can_finally_approve
                      ? undefined
                      : "Blocked: " + request.blocking_reasons.join(" ")
                  }
                  onClick={() => {
                    setDecision("approve");
                    setDecisionReason("");
                  }}
                >
                  Final approval
                </Button>
              </>
            )}
          </div>
        }
      />

      {error && (
        <Alert tone="danger" title="The decision was not recorded" className="mb-4">
          {error}
        </Alert>
      )}

      {request.hold_reason && (
        <Alert tone="danger" title="This case is on hold" className="mb-4">
          {request.hold_reason}
        </Alert>
      )}

      {!isDecided && request.blocking_reasons.length > 0 && (
        <Alert tone="warning" title="The request cannot proceed yet" className="mb-4">
          <ul className="list-disc space-y-0.5 pl-5">
            {request.blocking_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Alert>
      )}

      {request.status === "APPROVED" && (
        <Alert tone="success" title="Release request approved" className="mb-4">
          This records an administrative approval on {dateTime(request.decided_at)}. It is not a
          confirmation that a bank has released or refunded any amount — that remains separate
          evidence this portal may never receive.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card title="Case summary">
            <DefinitionList
              items={[
                { label: "Status", value: <StatusBadge dimension="release" value={request.status} /> },
                { label: "Basis", value: request.basis_label },
                { label: "Requested by", value: request.requested_by_label },
                {
                  label: "Prepared by (maker)",
                  value: request.prepared_by ? "Recorded" : "Not yet recorded",
                  help: "The preparing officer cannot be the final approver.",
                },
                {
                  label: "Approved by (checker)",
                  value: request.approved_by ? "Recorded" : "Not yet recorded",
                },
                { label: "Checklist version", value: request.policy_version },
              ]}
            />
            <div className="mt-4 rounded-lg bg-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Justification from the institution
              </p>
              <p className="mt-1 text-sm text-ink">{request.justification}</p>
            </div>
          </Card>

          <Card
            title="Prescribed documents"
            description="Instantiated from the checklist version in force when the case was opened."
          >
            <ul className="space-y-2">
              {request.checklist.map((item) => (
                <li
                  key={item.code}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{item.label}</p>
                    <p className="text-xs text-ink-muted">{item.code}</p>
                  </div>
                  <Badge tone={item.satisfied ? "success" : "warning"}>
                    {item.satisfied ? "On record" : "Missing"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>

          {request.approvals.length > 0 && (
            <Card title="Decision trail">
              <ol className="space-y-2.5">
                {request.approvals.map((approval) => (
                  <li key={approval.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge
                        tone={
                          approval.outcome === "APPROVED"
                            ? "success"
                            : approval.outcome === "REJECTED"
                              ? "danger"
                              : "info"
                        }
                      >
                        {approval.stage} · {approval.outcome.toLowerCase()}
                      </Badge>
                      <span className="text-xs text-ink-muted">{dateTime(approval.decided_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink">{approval.reason}</p>
                    <p className="text-xs text-ink-muted">{approval.actor_label}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card
            title="Bureau clearances"
            description="Each clearance carries its issuing authority, outcome, reason, recorded identity and validity."
          >
            <ClearanceMatrix
              clearances={request.clearances}
              canDecide={(bureauCode) =>
                !isDecided &&
                can("release:clear") &&
                Boolean(session?.bureau_codes.includes(bureauCode))
              }
              onDecide={(bureauCode) => {
                setClearanceBureau(bureauCode);
                setClearanceOutcome("CLEARED");
                setClearanceReason("");
                setValidUntil("");
              }}
            />
            {can("release:clear") && session?.bureau_codes.length === 0 && (
              <p className="mt-3 text-xs text-ink-muted">
                You are not assigned to any bureau on this case, so no clearance control is offered.
              </p>
            )}
          </Card>

          <Card title="What final approval means here">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
              <li>Every required clearance must be affirmative and current.</li>
              <li>Every prescribed document must be on record and cleared by scanning.</li>
              <li>No hold condition may remain.</li>
              <li>The officer who prepared the case cannot approve it.</li>
              <li>The institution's requester cannot approve it.</li>
              <li>
                The approval is recorded as <em>release request approved</em> — separate from any
                bank-side discharge.
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* --- clearance decision --- */}
      <Dialog
        open={Boolean(clearanceBureau)}
        title={`Record the ${clearanceBureau} decision`}
        description="Your identity, the reason and the time are stored against this requirement. An objection puts the case on hold."
        onClose={() => setClearanceBureau(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearanceBureau(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={decide.isPending}
              disabled={clearanceReason.trim().length < 5}
              onClick={async () => {
                setError(null);
                try {
                  await decide.mutateAsync({
                    bureauCode: clearanceBureau!,
                    outcome: clearanceOutcome,
                    reason: clearanceReason.trim(),
                    validUntil: validUntil || undefined,
                  });
                  setClearanceBureau(null);
                } catch (caught) {
                  setError(
                    caught instanceof ApiError
                      ? caught.message
                      : "The clearance decision could not be recorded.",
                  );
                }
              }}
            >
              Record decision
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Outcome" required>
            {(props) => (
              <Select
                {...props}
                value={clearanceOutcome}
                onChange={(event) => setClearanceOutcome(event.target.value)}
              >
                <option value="CLEARED">Cleared — no objection from this bureau</option>
                <option value="CLARIFICATION_REQUIRED">Clarification required</option>
                <option value="OBJECTION">Objection — place the case on hold</option>
              </Select>
            )}
          </Field>
          <Field label="Reason" required>
            {(props) => (
              <TextArea
                {...props}
                value={clearanceReason}
                onChange={(event) => setClearanceReason(event.target.value)}
                placeholder="What did this bureau check, and what is its conclusion?"
              />
            )}
          </Field>
          {clearanceOutcome === "CLEARED" && (
            <Field label="Valid until" hint="Optional. A stale clearance is flagged for re-confirmation.">
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              )}
            </Field>
          )}
        </div>
      </Dialog>

      {/* --- prepare / approve / reject --- */}
      <Dialog
        open={Boolean(decision)}
        title={
          decision === "prepare"
            ? "Record that you prepared this case"
            : decision === "approve"
              ? "Record final approval of this release request"
              : "Reject this release request"
        }
        description={
          decision === "approve"
            ? "This records an administrative approval against the current case version. It does not instruct a bank and does not move money."
            : decision === "prepare"
              ? "You will be recorded as the preparing officer, and you will not be able to give this case its final approval."
              : "The institution is notified and the case is closed as rejected."
        }
        onClose={() => setDecision(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision === "reject" ? "danger" : "primary"}
              loading={mutation.isPending}
              disabled={decisionReason.trim().length < 5}
              onClick={() => void runDecision()}
            >
              {decision === "prepare"
                ? "Record preparation"
                : decision === "approve"
                  ? "Record final approval"
                  : "Record rejection"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DefinitionList
            columns={2}
            items={[
              { label: "Case", value: `${request.id.slice(0, 8)} · ${request.institution_name}` },
              { label: "Instrument", value: request.fdr_number_masked },
              { label: "Principal", value: money(request.principal_amount) },
              { label: "Version you are acting on", value: String(request.version) },
            ]}
          />

          {decision === "approve" && (
            <Alert tone="info" title="Prerequisites verified at this moment">
              <ul className="list-disc space-y-0.5 pl-5">
                <li>All required clearances affirmative and current.</li>
                <li>All prescribed documents on record.</li>
                <li>No hold condition outstanding.</li>
                <li>Maker and checker are different people.</li>
              </ul>
              <p className="mt-1">
                They are checked again inside the transaction, so a change made while this dialog
                was open will stop the approval.
              </p>
            </Alert>
          )}

          <Field
            label="Reason / noting"
            required
            hint="Recorded immutably with your identity and the case version."
          >
            {(props) => (
              <TextArea
                {...props}
                rows={4}
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>
    </>
  );
}
