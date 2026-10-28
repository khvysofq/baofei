export const SCHEMA_VERSION = "demo-sc-v1.1" as const;
export const SCENARIO_VERSION = "demo-sc-v1.1" as const;

export type RegionValue = {
  province: string | null;
  city: string | null;
};

export type FieldSource = "text" | "user" | "sample" | "demo" | "unknown";

export type OwnerRelation = "self" | "family" | "unknown";
export type Intent = "scrap" | "replace" | "unknown";
export type DocumentsStatus =
  | "complete"
  | "missing_registration"
  | "unknown";

export const FIELD_NAMES = [
  "vehicleLocation",
  "registrationLocation",
  "ownerRelation",
  "drivable",
  "intent",
  "documentsStatus",
  "specialCase",
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

export const CORE_FIELD_NAMES = [
  "vehicleLocation",
  "registrationLocation",
  "ownerRelation",
  "drivable",
  "intent",
  "documentsStatus",
] as const;
export type CoreFieldName = (typeof CORE_FIELD_NAMES)[number];

export type FieldValue = RegionValue | string | boolean | null;

export type CaseField = {
  field: FieldName;
  value: FieldValue;
  source: FieldSource;
  confirmed: boolean;
  confidence: number | null;
  updatedAt: string;
};

export type CaseRecord = {
  id: string;
  caseNo: string;
  scenarioId: string | null;
  schemaVersion: string;
  scenarioVersion: string;
  profileVersion: number;
  materialsVersion: number;
  demo: boolean;
  intent: Intent;
  selectedQuoteProvider: string | null;
  selectedQuoteVersion: number | null;
  handedOverAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleRecord = {
  id: string;
  caseId: string;
  demoVehicleNo: string;
  plateMasked: string | null;
  energyType: string;
  useNature: string;
};

export type DocumentType =
  | "DRIVING_LICENSE"
  | "REGISTRATION_CERT"
  | "AUTHORIZATION";

export type DocumentRecord = {
  id: string;
  caseId: string;
  vehicleId: string;
  type: DocumentType;
  sampleId: string | null;
  fields: Record<string, string> | null;
  originalFields: Record<string, string> | null;
  issues: DocumentIssue[];
  quality: "clear" | "blur" | "mismatch" | null;
  verificationStatus: string;
  confirmed: boolean;
  uploadedAt: string | null;
  updatedAt: string;
};

export type DocumentIssue =
  | {
      kind: "blur";
      region: string;
      message: string;
    }
  | {
      kind: "mismatch";
      field: string;
      fieldLabel: string;
      region: string;
      original: string;
      extracted: string;
      message: string;
    };

export type TaskKind =
  | "unsupported_case"
  | "confirm_authorization"
  | "review_missing_document"
  | "confirm_materials"
  | "confirm_quote"
  | "confirm_appointment"
  | "obtain_recovery_certificate"
  | "verify_recovery_certificate"
  | "verify_deregistration"
  | "confirm_payment"
  | "subsidy_followup";

export type TaskStatus = "open" | "resolved" | "needs_reconfirmation";

export type TaskRecord = {
  id: string;
  kind: TaskKind;
  active: boolean;
  status: TaskStatus;
  reason: string | null;
  owner: string | null;
  resolutionVersions: ResolutionVersions | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolutionVersions = {
  profileVersion: number;
  materialsVersion: number;
  vehicleCity: string | null;
  registrationCity: string | null;
};

export type QuoteRecord = {
  id: string;
  caseId: string;
  providerId: string;
  providerName: string;
  version: number;
  currency: "CNY";
  grossFen: number | null;
  towFen: number | null;
  serviceFen: number | null;
  netFen: number | null;
  conditions: Record<string, string>;
  demo: boolean;
  active: boolean;
  profileVersion: number;
  createdAt: string;
};

export type AppointmentStatus = "booked" | "needs_reconfirmation" | "cancelled";

export type AppointmentRecord = {
  id: string;
  caseId: string;
  quoteId: string;
  quoteVersion: number;
  profileVersion: number;
  materialsVersion: number;
  slotId: string;
  location: string;
  handoverPerson: string | null;
  drivable: boolean | null;
  summary: Record<string, unknown>;
  status: AppointmentStatus;
  appointmentNo: string;
  idempotencyKey: string;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceType =
  | "HANDOVER_RECEIPT"
  | "RECOVERY_CERTIFICATE"
  | "DEREGISTRATION_CERTIFICATE";

export type EvidenceStatus =
  | "provided"
  | "pending_check"
  | "demo_verified"
  | "rejected";

export type EvidenceRecord = {
  id: string;
  caseId: string;
  vehicleId: string;
  type: EvidenceType;
  source: string;
  demo: boolean;
  eventTime: string;
  status: EvidenceStatus;
  description: string | null;
  createdAt: string;
};

export type SubsidyStatus =
  | "inactive"
  | "paused"
  | "info_pending"
  | "materials_pending"
  | "awaiting_official";

export type SubsidyContext = {
  caseId: string;
  active: boolean;
  status: SubsidyStatus;
  policyYear: number;
  purchaseStage: "not_bought" | "ordered" | "bought";
  plannedPurchaseRegion: RegionValue | null;
  invoiceRegion: RegionValue | null;
  newRegistrationProvince: string | null;
  acceptingCity: string | null;
  windowStatus: string;
  materials: string[];
  updatedAt: string;
};

export type EventSource = "user" | "rule" | "demo_controller" | "system";

export type EventRecord = {
  id: number;
  caseId: string;
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  source: EventSource;
  demo: boolean;
  createdAt: string;
};

export type TrackKey = "recovery" | "deregistration" | "settlement" | "subsidy";

export type TrackState = {
  key: TrackKey;
  label: string;
  status: string;
  statusLabel: string;
  tone: "neutral" | "waiting" | "warn" | "done" | "danger";
  basis: string;
  next: string;
};

export type ParseFieldResult = {
  value: FieldValue;
  source: FieldSource;
  confirmed: boolean;
  confidence: number;
};

export type ParseResult = {
  fields: Record<CoreFieldName, ParseFieldResult>;
  conflicts: ParseConflict[];
  degraded: boolean;
  options: ParseOption[];
  source: "rule" | "cache";
  demo: true;
};

export type ParseConflict = {
  field: CoreFieldName;
  kept: FieldValue;
  candidate: FieldValue;
  message: string;
};

export type ParseOption = {
  field: CoreFieldName;
  label: string;
  choices: { value: FieldValue; label: string }[];
};

export type CaseSnapshot = {
  case: CaseRecord;
  fields: CaseField[];
  vehicle: VehicleRecord;
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  quotes: QuoteRecord[];
  selectedQuote: QuoteRecord | null;
  appointment: AppointmentRecord | null;
  evidence: EvidenceRecord[];
  subsidy: SubsidyContext | null;
  tracks: TrackState[];
  nextAction: TaskRecord | null;
  stageNote: string;
  policy: PolicySummary;
};

export type PolicySummary = {
  region: string;
  scope: string;
  status: string;
  statusLabel: string;
  sourceIds: string[];
  checkedAt: string;
  notes: string;
  cityKnown: boolean;
};