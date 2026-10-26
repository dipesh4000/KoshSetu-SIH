// Status vocabulary.
//
// The wording follows the specification's label table: parsing is "fields
// extracted from document", a simulated bank result always says so, a
// discrepancy is never called fraud, and an approval is never called a refund.

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "simulated";

export interface StatusPresentation {
  label: string;
  tone: Tone;
  help?: string;
}

const SUBMISSION: Record<string, StatusPresentation> = {
  DRAFT: { label: "Draft", tone: "neutral", help: "Not yet submitted to AICTE." },
  UPLOADED: { label: "Document uploaded", tone: "info", help: "Submit to send for scrutiny." },
  SUBMITTED: { label: "Submitted", tone: "info", help: "Attested by the institution." },
  CORRECTION_REQUESTED: {
    label: "Correction requested",
    tone: "warning",
    help: "An officer has asked the institution for a correction.",
  },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
  NOT_SUBMITTED: { label: "Not submitted", tone: "neutral" },
};

const DOCUMENT: Record<string, StatusPresentation> = {
  NOT_UPLOADED: { label: "No document", tone: "neutral" },
  QUARANTINED: { label: "Security scanning", tone: "warning", help: "Not viewable until cleared." },
  SCANNING: { label: "Security scanning", tone: "warning" },
  EXTRACTING: { label: "Extracting document fields", tone: "info" },
  READY: { label: "Fields extracted from document", tone: "success" },
  MANUAL_REVIEW_REQUIRED: {
    label: "Manual document review needed",
    tone: "warning",
    help: "Some fields could not be read reliably.",
  },
  REJECTED: { label: "File rejected", tone: "danger" },
  FAILED: { label: "Processing failed", tone: "danger" },
  BLOCKED: { label: "Blocked by scanning", tone: "danger" },
};

const BANK: Record<string, StatusPresentation> = {
  NOT_REQUESTED: { label: "Bank simulation not run", tone: "neutral" },
  PENDING: { label: "Mock bank simulation pending", tone: "simulated" },
  MOCK_MATCH: {
    label: "Mock bank check passed — simulation",
    tone: "simulated",
    help: "Simulated response only. Not independent bank authentication.",
  },
  MOCK_MISMATCH: {
    label: "Mock bank check reported a difference — simulation",
    tone: "simulated",
    help: "Simulated response only. Raise a clarification; this is not proof of forgery.",
  },
  MOCK_ERROR: {
    label: "Mock bank check could not complete — simulation",
    tone: "simulated",
    help: "The simulated provider failed or its response was rejected.",
  },
  REJECTED_BY_PORTAL: {
    label: "Simulated response rejected by the portal",
    tone: "danger",
    help: "The response failed signature or replay validation. No status changed.",
  },
  AUTHENTICATED_EXTERNAL: {
    label: "Authorised bank verification",
    tone: "success",
    help: "Only reachable through an authorised integration, which this prototype does not have.",
  },
  EXTERNAL_UNAVAILABLE: { label: "Authorised bank channel unavailable", tone: "warning" },
};

const REVIEW: Record<string, StatusPresentation> = {
  NOT_SUBMITTED: { label: "Awaiting submission", tone: "neutral" },
  QUEUED: { label: "Ready for officer review", tone: "info" },
  IN_REVIEW: { label: "In review", tone: "info" },
  CLARIFICATION_REQUIRED: { label: "Clarification required", tone: "warning" },
  ACCEPTED: {
    label: "Accepted by officer",
    tone: "success",
    help: "An administrative decision in this demo workflow, recorded against simulated evidence.",
  },
  REJECTED: { label: "Rejected by officer", tone: "danger" },
};

const INSTRUMENT: Record<string, StatusPresentation> = {
  REGISTERED: { label: "Registered", tone: "neutral" },
  ACTIVE: { label: "Active", tone: "success" },
  SUPERSEDED: { label: "Superseded by replacement", tone: "info" },
  MATURED: { label: "Matured", tone: "warning" },
  RELEASE_RECORDED: {
    label: "Release request approved",
    tone: "info",
    help: "An administrative approval. It is not a confirmation that a bank released any amount.",
  },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const LIEN: Record<string, StatusPresentation> = {
  UNKNOWN: { label: "Lien not recorded", tone: "neutral" },
  CLAIMED: { label: "Lien claimed", tone: "info", help: "Declared by the institution or a simulated source." },
  CONFIRMED: { label: "Lien confirmed by authorised source", tone: "success" },
  DISPUTED: { label: "Lien not confirmed", tone: "danger" },
  RELEASED: { label: "Lien released", tone: "neutral" },
};

const RELEASE: Record<string, StatusPresentation> = {
  NOT_REQUESTED: { label: "No request", tone: "neutral" },
  REQUESTED: { label: "Requested", tone: "info" },
  DOCUMENTS_PENDING: { label: "Documents pending", tone: "warning" },
  CLEARANCES_PENDING: { label: "Clearances pending", tone: "warning" },
  ON_HOLD: { label: "On hold", tone: "danger" },
  READY_FOR_DECISION: { label: "Ready for decision", tone: "info" },
  APPROVED: {
    label: "Release request approved",
    tone: "success",
    help: "Administrative approval only — distinct from a completed bank release.",
  },
  REJECTED: { label: "Rejected", tone: "danger" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

const CLEARANCE: Record<string, StatusPresentation> = {
  PENDING: { label: "Pending", tone: "warning" },
  CLEARED: { label: "Cleared", tone: "success" },
  OBJECTION: { label: "Objection recorded", tone: "danger" },
  CLARIFICATION_REQUIRED: { label: "Clarification required", tone: "warning" },
};

const SEVERITY: Record<string, StatusPresentation> = {
  BLOCKER: { label: "Blocker", tone: "danger" },
  CRITICAL: { label: "Critical", tone: "danger" },
  HIGH: { label: "High", tone: "warning" },
  MEDIUM: { label: "Medium", tone: "info" },
  ATTENTION: { label: "Attention", tone: "info" },
  LOW: { label: "Low", tone: "neutral" },
};

const FINDING_STATUS: Record<string, StatusPresentation> = {
  OPEN: { label: "Open", tone: "warning" },
  ACKNOWLEDGED: { label: "Acknowledged", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  AUTO_RESOLVED: { label: "Resolved automatically", tone: "success" },
  FALSE_POSITIVE: { label: "Recorded as false positive", tone: "neutral" },
};

const ATTENTION: Record<string, StatusPresentation> = {
  CRITICAL: { label: "Critical", tone: "danger" },
  HIGH: { label: "High", tone: "warning" },
  ROUTINE: { label: "Routine", tone: "neutral" },
};

const DIMENSIONS: Record<string, Record<string, StatusPresentation>> = {
  submission: SUBMISSION,
  document: DOCUMENT,
  bank: BANK,
  review: REVIEW,
  instrument: INSTRUMENT,
  lien: LIEN,
  release: RELEASE,
  clearance: CLEARANCE,
  severity: SEVERITY,
  finding: FINDING_STATUS,
  attention: ATTENTION,
};

export type Dimension = keyof typeof DIMENSIONS;

export function present(dimension: Dimension, value: string | null | undefined): StatusPresentation {
  if (!value) return { label: "—", tone: "neutral" };
  return (
    DIMENSIONS[dimension]?.[value] ?? {
      label: value.replace(/_/g, " ").toLowerCase(),
      tone: "neutral",
    }
  );
}

export const DIMENSION_TITLES: Record<string, string> = {
  submission: "Institution submission",
  document: "Document processing",
  bank: "Bank-source check",
  review: "AICTE scrutiny",
  instrument: "Instrument lifecycle",
  lien: "Lien",
};

export const CATEGORY_LABELS: Record<string, string> = {
  DATA_DISCREPANCY: "Data discrepancy",
  VERIFICATION_REQUIRED: "Verification required",
  DEADLINE_RISK: "Deadline risk",
  MISSING_EVIDENCE: "Missing evidence",
  POLICY_HOLD: "Policy hold",
  DUPLICATE_CANDIDATE: "Duplicate candidate",
};
