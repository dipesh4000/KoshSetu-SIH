// Five-step submission.
//
// The draft is created before the file is transferred, so closing the browser
// cannot lose entered metadata, and a retry reuses the same upload session. The
// processing states shown are the server's real states — never a timer-driven
// fake progress bar.

import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { EvidencePanel } from "../../components/fdr/EvidencePanel";
import {
  Alert,
  Button,
  Card,
  DefinitionList,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "../../components/ui/primitives";
import { ApiError, uploadObject } from "../../lib/api/client";
import {
  useCreateDraft,
  useCreateUploadSession,
  useFinalizeUpload,
  usePatchDraft,
  useSubmitFdr,
} from "../../lib/api/hooks";
import type { EvidenceField, FdrDetail, UploadFinalizeResult } from "../../lib/api/types";
import { useSession } from "../../lib/auth/session";
import { bytes, fieldLabel, longDate, money } from "../../lib/format";

const STEPS = [
  { key: "identity", title: "Identity", description: "Institution and issuing bank" },
  { key: "instrument", title: "Instrument", description: "Reference, amount and dates" },
  { key: "upload", title: "Upload", description: "Instrument document" },
  { key: "compare", title: "Confirm fields", description: "Declared versus document" },
  { key: "attest", title: "Review & attest", description: "Submit for scrutiny" },
] as const;

const PROCESS_CATEGORIES = [
  { value: "NEW_APPROVAL", label: "New approval / recognition deposit" },
  { value: "EXTENSION_OF_APPROVAL", label: "Extension of approval" },
  { value: "NEW_COURSE", label: "New course or programme" },
  { value: "INCREASE_IN_INTAKE", label: "Increase in intake" },
  { value: "OTHER", label: "Other (record the reason in the justification)" },
];

interface FormState {
  process_category: string;
  issuer_bank: string;
  branch: string;
  ifsc: string;
  fdr_number: string;
  principal_amount: string;
  interest_rate: string;
  issue_date: string;
  maturity_date: string;
  lien_beneficiary: string;
}

const EMPTY_FORM: FormState = {
  process_category: "NEW_APPROVAL",
  issuer_bank: "",
  branch: "",
  ifsc: "",
  fdr_number: "",
  principal_amount: "",
  interest_rate: "",
  issue_date: "",
  maturity_date: "",
  lien_beneficiary: "AICTE, New Delhi",
};

type ProcessingState =
  | "IDLE"
  | "PENDING_UPLOAD"
  | "SCANNING"
  | "EXTRACTING"
  | "READY_FOR_CONFIRMATION"
  | "MANUAL_REVIEW_REQUIRED"
  | "FAILED";

const PROCESSING_COPY: Record<ProcessingState, string> = {
  IDLE: "No file selected yet.",
  PENDING_UPLOAD: "Transferring the file to private storage…",
  SCANNING: "The file is uploaded. Security scanning is still running. Do not submit until it is cleared.",
  EXTRACTING: "Extracting document fields…",
  READY_FOR_CONFIRMATION: "Fields extracted from the document. Confirm each value below.",
  MANUAL_REVIEW_REQUIRED:
    "Some fields could not be read reliably. Compare with the document and enter the correct values.",
  FAILED: "The file was not accepted. Your entered details have been saved.",
};

export function SubmissionWizardPage() {
  const navigate = useNavigate();
  const { session } = useSession();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [revealNumber, setRevealNumber] = useState(false);
  const [draft, setDraft] = useState<FdrDetail | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>("IDLE");
  const [uploadResult, setUploadResult] = useState<UploadFinalizeResult | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [attested, setAttested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createDraft = useCreateDraft();
  const patchDraft = usePatchDraft(draft?.id ?? "");
  const createSession = useCreateUploadSession();
  const finalize = useFinalizeUpload(draft?.id ?? "");
  const submit = useSubmitFdr(draft?.id ?? "");

  const evidenceFields: EvidenceField[] = uploadResult?.evidence_fields ?? draft?.evidence_fields ?? [];

  const summaryItems = useMemo(
    () => [
      { label: "Institution", value: draft?.institution.name ?? "From your account" },
      { label: "Process / category", value: PROCESS_CATEGORIES.find((item) => item.value === form.process_category)?.label ?? "—" },
      { label: "Issuer bank", value: form.issuer_bank || "—" },
      { label: "Branch", value: form.branch || "—" },
      { label: "IFSC", value: form.ifsc || "—" },
      {
        label: "FDR number",
        value: draft?.fdr_number_masked ?? (form.fdr_number ? `••••${form.fdr_number.slice(-4)}` : "—"),
        help: "Only the masked form is stored for display. The full reference is kept encrypted.",
      },
      {
        label: "Principal amount",
        value: corrections.principal_amount
          ? `${money(corrections.principal_amount)} (corrected)`
          : money(form.principal_amount),
      },
      { label: "Interest rate", value: form.interest_rate ? `${form.interest_rate}% p.a.` : "—" },
      { label: "Issue date", value: longDate(form.issue_date) },
      {
        label: "Maturity date",
        value: corrections.maturity_date
          ? `${longDate(corrections.maturity_date)} (corrected)`
          : longDate(form.maturity_date),
      },
      { label: "Lien beneficiary", value: form.lien_beneficiary || "Not recorded" },
      {
        label: "Document",
        value: uploadResult
          ? `${uploadResult.scan_status === "CLEAN" ? "Cleared by scanning" : "Rejected"} · version on record`
          : "Not uploaded",
      },
    ],
    [draft, form, corrections, uploadResult],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateIdentity(): boolean {
    const next: Record<string, string> = {};
    if (form.issuer_bank.trim().length < 3) next.issuer_bank = "Enter the issuing bank's name.";
    if (form.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc))
      next.ifsc = "An IFSC is 11 characters, for example SBIN0001234. Format is checked, not bank identity.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateInstrument(): boolean {
    const next: Record<string, string> = {};
    if (form.fdr_number.trim().length < 4) next.fdr_number = "Enter the instrument reference as printed.";
    const amount = Number(form.principal_amount);
    if (!Number.isFinite(amount) || amount <= 0)
      next.principal_amount = "Enter the principal amount in rupees, greater than zero.";
    if (!form.issue_date) next.issue_date = "Enter the date of deposit.";
    if (!form.maturity_date) next.maturity_date = "Enter the maturity date.";
    if (form.issue_date && form.maturity_date && form.maturity_date < form.issue_date)
      next.maturity_date = "The maturity date cannot be before the issue date.";
    if (form.issue_date && form.issue_date > new Date().toISOString().slice(0, 10))
      next.issue_date = "The issue date cannot be in the future.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function saveDraft() {
    setFormError(null);
    const body = {
      issuer_bank: form.issuer_bank.trim(),
      branch: form.branch.trim() || null,
      ifsc: form.ifsc.trim() || null,
      fdr_number: form.fdr_number.trim(),
      principal_amount: Number(form.principal_amount).toFixed(2),
      interest_rate: form.interest_rate ? Number(form.interest_rate).toFixed(2) : null,
      issue_date: form.issue_date,
      maturity_date: form.maturity_date,
      lien_beneficiary: form.lien_beneficiary.trim() || null,
    };
    try {
      if (draft) {
        const updated = await patchDraft.mutateAsync(body);
        setDraft(updated);
      } else {
        const created = await createDraft.mutateAsync(body);
        setDraft(created);
      }
      setStep(2);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("The draft could not be saved. Try again.");
      }
    }
  }

  async function runUpload() {
    if (!file || !draft) return;
    setFormError(null);
    setProcessing("PENDING_UPLOAD");
    try {
      const session_ = await createSession.mutateAsync({
        fdr_id: draft.id,
        filename: file.name,
        content_type: file.type || "application/pdf",
        size_bytes: file.size,
      });
      await uploadObject(session_.upload_url, file);
      setProcessing("SCANNING");
      const result = await finalize.mutateAsync(session_.upload_session_id);
      setUploadResult(result);

      if (result.scan_status !== "CLEAN") {
        setProcessing("FAILED");
        return;
      }
      setProcessing(
        result.extraction_status === "READY" ? "READY_FOR_CONFIRMATION" : "MANUAL_REVIEW_REQUIRED",
      );
      setStep(3);
    } catch (error) {
      setProcessing("FAILED");
      setFormError(
        error instanceof ApiError
          ? error.message
          : "This file could not be accepted. Upload a PDF up to the allowed size; your entered details were saved.",
      );
    }
  }

  async function submitForScrutiny() {
    if (!draft) return;
    setFormError(null);
    try {
      const detail = await submit.mutateAsync({
        attestation: true,
        corrections: Object.keys(corrections).length > 0 ? corrections : undefined,
        correction_reason: Object.keys(corrections).length > 0 ? correctionReason : undefined,
      });
      navigate(`/institution/fdrs/${detail.id}`, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "The submission could not be completed.",
      );
    }
  }

  const differingFields = evidenceFields.filter((item) => item.difference === "DIFFERS");
  const unreadableFields = evidenceFields.filter((item) => item.difference === "NOT_FOUND");

  return (
    <>
      <PageHeader
        title="New deposit submission"
        description="Record the instrument, upload its document, confirm the extracted fields and attest before it reaches an officer."
        meta={
          <span>
            Institution: {session?.institution_ids.length ? draft?.institution.name ?? "from your account" : "—"}
          </span>
        }
      />

      <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Submission progress">
        {STEPS.map((item, index) => {
          const state = index < step ? "done" : index === step ? "current" : "upcoming";
          return (
            <li
              key={item.key}
              aria-current={state === "current" ? "step" : undefined}
              className={`rounded-lg border p-2.5 ${
                state === "current"
                  ? "border-brand bg-brand/5"
                  : state === "done"
                    ? "border-success/40 bg-success-soft"
                    : "border-line bg-surface"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {state === "done" ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`tabular flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                      state === "current" ? "bg-brand text-white" : "bg-subtle text-ink-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
                <p className="text-sm font-semibold text-ink">{item.title}</p>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{item.description}</p>
              <span className="sr-only">
                {state === "done" ? "Completed" : state === "current" ? "Current step" : "Not started"}
              </span>
            </li>
          );
        })}
      </ol>

      {formError && (
        <Alert tone="danger" title="This step could not be completed" className="mb-4">
          {formError}
        </Alert>
      )}

      {step === 0 && (
        <Card title="Step 1 — Identity and issuing bank">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Institution" hint="Taken from your authenticated account and not editable here.">
              {(props) => (
                <TextInput
                  {...props}
                  readOnly
                  value={draft?.institution.name ?? "Your institution"}
                  className="bg-subtle"
                />
              )}
            </Field>
            <Field label="Process / category" required>
              {(props) => (
                <Select
                  {...props}
                  value={form.process_category}
                  onChange={(event) => update("process_category", event.target.value)}
                >
                  {PROCESS_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Issuer bank" required error={errors.issuer_bank}>
              {(props) => (
                <TextInput
                  {...props}
                  value={form.issuer_bank}
                  onChange={(event) => update("issuer_bank", event.target.value)}
                  placeholder="State Bank of India"
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label="Branch">
              {(props) => (
                <TextInput
                  {...props}
                  value={form.branch}
                  onChange={(event) => update("branch", event.target.value)}
                  placeholder="Anna Salai"
                />
              )}
            </Field>
            <Field
              label="IFSC"
              hint="The format is validated. Bank identity is not confirmed unless an authorised registry is available."
              error={errors.ifsc}
            >
              {(props) => (
                <TextInput
                  {...props}
                  value={form.ifsc}
                  onChange={(event) => update("ifsc", event.target.value.toUpperCase())}
                  placeholder="SBIN0001234"
                  maxLength={11}
                />
              )}
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                if (validateIdentity()) setStep(1);
              }}
            >
              Continue to instrument details
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title="Step 2 — Instrument metadata">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="FDR / deposit number"
              required
              error={errors.fdr_number}
              hint="Enter it exactly as printed. Only the last four digits are displayed afterwards."
            >
              {(props) => (
                <div className="flex gap-2">
                  <TextInput
                    {...props}
                    type={revealNumber ? "text" : "password"}
                    value={form.fdr_number}
                    onChange={(event) => update("fdr_number", event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button variant="secondary" onClick={() => setRevealNumber((current) => !current)}>
                    {revealNumber ? "Hide" : "Reveal"}
                  </Button>
                </div>
              )}
            </Field>

            <Field
              label="Principal amount (INR)"
              required
              error={errors.principal_amount}
              hint="Exact rupees and paise. Stored as a decimal, never as a floating-point number."
            >
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={form.principal_amount}
                  onChange={(event) => update("principal_amount", event.target.value)}
                  placeholder="2500000.00"
                  className="tabular"
                />
              )}
            </Field>

            <Field label="Date of deposit" required error={errors.issue_date}>
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={form.issue_date}
                  onChange={(event) => update("issue_date", event.target.value)}
                />
              )}
            </Field>

            <Field label="Maturity date" required error={errors.maturity_date}>
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={form.maturity_date}
                  onChange={(event) => update("maturity_date", event.target.value)}
                />
              )}
            </Field>

            <Field label="Interest rate (% per annum)">
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  step="0.01"
                  min="0"
                  max="99"
                  value={form.interest_rate}
                  onChange={(event) => update("interest_rate", event.target.value)}
                  placeholder="7.10"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              label="Lien beneficiary"
              hint="Who the deposit is marked in favour of, as printed on the instrument."
            >
              {(props) => (
                <TextInput
                  {...props}
                  value={form.lien_beneficiary}
                  onChange={(event) => update("lien_beneficiary", event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              variant="primary"
              loading={createDraft.isPending || patchDraft.isPending}
              onClick={() => {
                if (validateInstrument()) void saveDraft();
              }}
            >
              Save draft and continue
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            The draft is saved before any file is transferred, so closing this page will not lose
            what you have entered.
          </p>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 3 — Upload the instrument document">
          <Alert tone="info" title="Before you upload">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>PDF only, up to 10 MB in this environment.</li>
              <li>
                Redact anything the process does not require. The document is stored privately and
                is only opened through a short-lived authorised link.
              </li>
              <li>The file is scanned before anyone can view it, including you.</li>
            </ul>
          </Alert>

          <div className="mt-4 rounded-lg border-2 border-dashed border-line bg-subtle/50 p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <FileUp aria-hidden="true" className="size-7 text-ink-muted" />
              <div>
                <label htmlFor="instrument-file" className="text-sm font-semibold text-ink">
                  Choose the instrument PDF
                </label>
                <p className="mt-0.5 text-xs text-ink-muted">
                  You can also drop a file here. A standard file chooser is always available —
                  drag and drop is never required.
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="instrument-file"
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setProcessing("IDLE");
                  setFormError(null);
                }}
                className="block w-full max-w-sm cursor-pointer rounded-lg border border-line bg-surface p-2 text-sm"
              />
              {file && (
                <p className="tabular text-sm text-ink">
                  {file.name} · {bytes(file.size)}
                </p>
              )}
            </div>
          </div>

          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-sm"
          >
            {["PENDING_UPLOAD", "SCANNING", "EXTRACTING"].includes(processing) && (
              <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin text-brand" />
            )}
            <div>
              <p className="font-medium text-ink">
                {processing === "IDLE" ? "Waiting for a file" : processing.replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-ink-muted">{PROCESSING_COPY[processing]}</p>
              {uploadResult?.scan_detail && processing === "FAILED" && (
                <p className="mt-1 text-danger">{uploadResult.scan_detail}</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex gap-2">
              {uploadResult?.scan_status === "CLEAN" && (
                <Button variant="secondary" onClick={() => setStep(3)}>
                  Continue with the cleared file
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!file}
                loading={["PENDING_UPLOAD", "SCANNING", "EXTRACTING"].includes(processing)}
                onClick={() => void runUpload()}
              >
                Upload and scan
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card
          title="Step 4 — Confirm the extracted fields"
          description="Extraction identifies text in your document. It does not authenticate the instrument or the issuer."
        >
          {differingFields.length > 0 && (
            <Alert tone="warning" title="Some values differ from the document" className="mb-4">
              <p>
                {differingFields.map((item) => fieldLabel(item.field)).join(", ")} differ from what
                was parsed. Correct your entry, or keep it and explain why — an officer will review
                either way. A difference is not evidence of wrongdoing.
              </p>
            </Alert>
          )}
          {unreadableFields.length > 0 && (
            <Alert tone="info" title="Some fields could not be read" className="mb-4">
              {unreadableFields.map((item) => fieldLabel(item.field)).join(", ")} were not found in
              the document. Check the document and confirm your entry.
            </Alert>
          )}

          <EvidencePanel fields={evidenceFields} />

          <div className="mt-5 space-y-4 rounded-lg border border-line bg-subtle/40 p-4">
            <p className="text-sm font-semibold text-ink">Correct a value (optional)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Principal amount (corrected)">
                {(props) => (
                  <TextInput
                    {...props}
                    type="number"
                    step="0.01"
                    className="tabular"
                    placeholder={form.principal_amount}
                    value={corrections.principal_amount ?? ""}
                    onChange={(event) =>
                      setCorrections((current) => {
                        const next = { ...current };
                        if (event.target.value) next.principal_amount = Number(event.target.value).toFixed(2);
                        else delete next.principal_amount;
                        return next;
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Maturity date (corrected)">
                {(props) => (
                  <TextInput
                    {...props}
                    type="date"
                    value={corrections.maturity_date ?? ""}
                    onChange={(event) =>
                      setCorrections((current) => {
                        const next = { ...current };
                        if (event.target.value) next.maturity_date = event.target.value;
                        else delete next.maturity_date;
                        return next;
                      })
                    }
                  />
                )}
              </Field>
            </div>
            {Object.keys(corrections).length > 0 && (
              <Field
                label="Reason for the correction"
                required
                hint="The original value, your corrected value, this reason, your identity and the time are all recorded."
              >
                {(props) => (
                  <TextInput
                    {...props}
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    placeholder="Data entry error; the document value is correct."
                  />
                )}
              </Field>
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back to upload
            </Button>
            <Button
              variant="primary"
              disabled={Object.keys(corrections).length > 0 && correctionReason.trim().length < 5}
              onClick={() => setStep(4)}
            >
              Continue to review
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card title="Step 5 — Review and attest">
          <DefinitionList items={summaryItems} />

          <div className="mt-5 rounded-lg border border-line bg-subtle/50 p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={attested}
                onChange={(event) => setAttested(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span className="text-ink">
                I attest that the details above are accurate, that the uploaded document is a true
                copy of the instrument held in favour of AICTE, and that I am authorised to submit
                it on behalf of this institution.
              </span>
            </label>
            <p className="mt-2 text-xs text-ink-muted">
              After submission these attested values cannot be edited directly. A change travels
              through a correction request with a reason, and the earlier version stays on record.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              variant="primary"
              disabled={!attested}
              loading={submit.isPending}
              onClick={() => void submitForScrutiny()}
            >
              Attest and submit for scrutiny
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
