// DTOs mirroring the backend contracts. The status dimensions stay separate
// here exactly as they do in the API: there is no single "FDR status".

export interface Meta {
  environment: string;
  bank_provider: string;
  is_simulated_environment: boolean;
  problem_statement_id: string;
  problem_statement_title: string;
  issuer: string;
  disclaimer: string;
}

export interface Session {
  user_id: string;
  email: string;
  display_name: string;
  roles: string[];
  capabilities: string[];
  institution_ids: string[];
  region_codes: string[];
  bureau_codes: string[];
  mfa_enrolled: boolean;
  workspace: "institution" | "official" | "admin";
  csrf_token: string | null;
}

export interface Institution {
  id: string;
  aicte_id: string;
  name: string;
  region_code: string;
  state: string;
  status: string;
  legal_holder_name: string | null;
}

export interface StatusBlock {
  submission_status: string;
  document_processing_status: string;
  bank_verification_status: string;
  review_status: string;
  instrument_status: string;
  lien_status: string;
}

export interface FdrListItem {
  id: string;
  institution_id: string;
  institution_name: string;
  aicte_id: string;
  region_code: string;
  issuer_bank: string;
  fdr_number_masked: string;
  principal_amount: string;
  currency: string;
  issue_date: string;
  maturity_date: string;
  days_remaining: number;
  is_maturing: boolean;
  status: StatusBlock;
  assigned_officer_id: string | null;
  attention_level: "CRITICAL" | "HIGH" | "ROUTINE";
  open_finding_count: number;
  version: number;
  updated_at: string;
}

export type FieldDifference = "MATCH" | "DIFFERS" | "NOT_FOUND" | "NOT_COMPARABLE";

export interface EvidenceField {
  field: string;
  declared_value: string | null;
  extracted_value: string | null;
  extracted_raw: string | null;
  confidence: number;
  page_index: number | null;
  bbox: number[] | null;
  difference: FieldDifference;
}

export interface DocumentSummary {
  id: string;
  document_type: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  scan_status: string;
  scan_detail: string | null;
  processing_status: string;
  version: number;
  uploaded_at: string;
  is_viewable: boolean;
}

export interface VerificationCheck {
  id: string;
  check_type: string;
  source_kind: "MOCK_BANK" | "AUTHORIZED_BANK" | "DOCUMENT" | "RULES";
  scenario_id: string | null;
  result: string;
  is_simulated: boolean;
  message: string | null;
  match_results: Record<string, string>;
  lien_claim: string | null;
  response_hash: string | null;
  correlation_id: string | null;
  performed_at: string;
  expires_at: string | null;
  provenance_note: string;
}

export interface Finding {
  id: string;
  fdr_id: string;
  rule_id: string;
  rule_version: string;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  recommended_action: string;
  evidence: Record<string, string>;
  status: string;
  disposition_reason: string | null;
  detected_at: string;
  institution_name: string | null;
  fdr_number_masked: string | null;
}

export interface AuditEvent {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_label: string;
  action: string;
  outcome: string;
  reason: string | null;
  old_state_summary: string | null;
  new_state_summary: string | null;
  request_id: string | null;
  integrity_digest: string;
  occurred_at: string;
}

export interface ReviewDecision {
  id: string;
  decision: string;
  reason: string;
  actor_label: string;
  created_at: string;
}

export interface FdrLink {
  id: string;
  relationship_type: string;
  effective_date: string;
  reason: string | null;
  predecessor_fdr_id: string;
  successor_fdr_id: string;
  predecessor_masked: string;
  successor_masked: string;
}

export interface FdrDetail {
  id: string;
  institution: Institution;
  issuer_bank: string;
  branch: string | null;
  ifsc: string | null;
  fdr_number_masked: string;
  principal_amount: string;
  currency: string;
  interest_rate: string | null;
  issue_date: string;
  maturity_date: string;
  days_remaining: number;
  lien_beneficiary: string | null;
  status: StatusBlock;
  assigned_officer_id: string | null;
  version: number;
  attention_level: "CRITICAL" | "HIGH" | "ROUTINE";
  created_at: string;
  updated_at: string;
  evidence_fields: EvidenceField[];
  documents: DocumentSummary[];
  verification_checks: VerificationCheck[];
  findings: Finding[];
  review_decisions: ReviewDecision[];
  links: FdrLink[];
  release_request_id: string | null;
  permitted_actions: string[];
}

export interface UploadSession {
  upload_session_id: string;
  upload_url: string;
  method: string;
  max_size_bytes: number;
  accepted_content_types: string[];
  expires_at: string;
  notes: string;
}

export interface UploadFinalizeResult {
  document_id: string;
  scan_status: string;
  scan_detail: string;
  processing_status: string;
  extraction_status: string | null;
  evidence_fields: EvidenceField[];
  document_processing_status: string;
}

export interface Kpi {
  key: string;
  label: string;
  value: string;
  unit: string;
  inclusion_criteria: string;
  filter_hint: Record<string, string>;
}

export interface Bucket {
  label: string;
  month: string | null;
  count: number;
  amount: string;
}

export interface Overview {
  scope_label: string;
  as_of: string;
  kpis: Kpi[];
  maturity_by_month: Bucket[];
  verification_backlog: Bucket[];
  action_needed: FdrListItem[];
  recent_activity: AuditEvent[];
}

export interface MaturityItem {
  fdr: FdrListItem;
  band: string;
  next_action: string;
  reminders_sent: number;
  predecessor_id: string | null;
  successor_id: string | null;
}

export interface Clearance {
  id: string;
  bureau_code: string;
  bureau_name: string;
  required: boolean;
  state: string;
  requirement_version: string;
  outcome: string | null;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  valid_until: string | null;
}

export interface Approval {
  id: string;
  stage: string;
  outcome: string;
  reason: string;
  actor_label: string;
  decided_at: string;
}

export interface ChecklistItem {
  code: string;
  label: string;
  satisfied: boolean;
  document_id: string | null;
}

export interface ReleaseRequest {
  id: string;
  fdr_id: string;
  fdr_number_masked: string;
  institution_id: string;
  institution_name: string;
  basis_code: string;
  basis_label: string;
  justification: string;
  status: string;
  hold_reason: string | null;
  policy_version: string;
  version: number;
  requested_by_label: string;
  prepared_by: string | null;
  approved_by: string | null;
  created_at: string;
  decided_at: string | null;
  clearances: Clearance[];
  checklist: ChecklistItem[];
  approvals: Approval[];
  blocking_reasons: string[];
  can_finally_approve: boolean;
  principal_amount: string;
  maturity_date: string;
}

export interface ReleasePolicyBasis {
  code: string;
  label: string;
  required_documents: { code: string; label: string }[];
  clearances: { code: string; name: string }[];
}

export interface ReleasePolicy {
  checklist_name: string;
  version: string;
  sha256: string;
  effective_from: string;
  bases: ReleasePolicyBasis[];
  note: string;
}

export interface Notification {
  id: string;
  event_type: string;
  category: string;
  title: string;
  body: string;
  due_date: string | null;
  fdr_id: string | null;
  release_request_id: string | null;
  status: string;
  read_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface ReportTable {
  columns: string[];
  rows: string[][];
  report_run_id: string;
  scope_label: string;
  generated_at: string;
  watermark: string;
}

export interface RuleCatalog {
  ruleset_name: string;
  version: string;
  sha256: string;
  thresholds: Record<string, number>;
  rules: {
    id: string;
    category: string;
    severity: string;
    authority: string;
    title: string;
    recommended_action: string;
  }[];
  note: string;
}

export interface ScenarioCatalog {
  provider: string;
  environment: string;
  is_simulated: boolean;
  disclaimer: string;
  scenarios: { id: string; expected_outcome: string; description: string }[];
}
