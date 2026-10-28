import type {
  AppointmentRecord,
  CaseField,
  CaseRecord,
  DocumentIssue,
  DocumentRecord,
  EvidenceRecord,
  FieldValue,
  Intent,
  QuoteRecord,
  SubsidyContext,
  TaskRecord,
  VehicleRecord,
} from "@/lib/types";

type Row = Record<string, unknown>;

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function mapCase(row: Row): CaseRecord {
  return {
    id: String(row.id),
    caseNo: String(row.case_no),
    scenarioId: row.scenario_id ? String(row.scenario_id) : null,
    schemaVersion: String(row.schema_version),
    scenarioVersion: String(row.scenario_version),
    profileVersion: Number(row.profile_version),
    materialsVersion: Number(row.materials_version),
    demo: Boolean(row.demo),
    intent: String(row.intent) as Intent,
    selectedQuoteProvider: row.selected_quote_provider
      ? String(row.selected_quote_provider)
      : null,
    selectedQuoteVersion:
      row.selected_quote_version === null || row.selected_quote_version === undefined
        ? null
        : Number(row.selected_quote_version),
    handedOverAt: iso(row.handed_over_at),
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
  };
}

export function mapField(row: Row): CaseField {
  return {
    field: String(row.field) as CaseField["field"],
    value: (row.value ?? null) as FieldValue,
    source: String(row.source) as CaseField["source"],
    confirmed: Boolean(row.confirmed),
    confidence: row.confidence === null ? null : Number(row.confidence),
    updatedAt: iso(row.updated_at) ?? "",
  };
}

export function mapVehicle(row: Row): VehicleRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    demoVehicleNo: String(row.demo_vehicle_no),
    plateMasked: row.plate_masked ? String(row.plate_masked) : null,
    energyType: String(row.energy_type),
    useNature: String(row.use_nature),
  };
}

export function mapDocument(row: Row): DocumentRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    vehicleId: String(row.vehicle_id),
    type: String(row.type) as DocumentRecord["type"],
    sampleId: row.sample_id ? String(row.sample_id) : null,
    fields: (row.fields ?? null) as Record<string, string> | null,
    originalFields: (row.original_fields ?? null) as Record<string, string> | null,
    issues: (row.issues ?? []) as DocumentIssue[],
    quality: (row.quality ?? null) as DocumentRecord["quality"],
    verificationStatus: String(row.verification_status),
    confirmed: Boolean(row.confirmed),
    uploadedAt: iso(row.created_at),
    updatedAt: iso(row.updated_at) ?? "",
  };
}

export function mapTask(row: Row): TaskRecord {
  return {
    id: String(row.id),
    kind: String(row.kind) as TaskRecord["kind"],
    active: Boolean(row.active),
    status: String(row.status) as TaskRecord["status"],
    reason: row.reason ? String(row.reason) : null,
    owner: row.owner ? String(row.owner) : null,
    resolutionVersions: (row.resolution_versions ?? null) as TaskRecord["resolutionVersions"],
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
  };
}

export function mapQuote(row: Row): QuoteRecord {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    providerId: String(row.provider_id),
    providerName: String(row.provider_name),
    version: Number(row.version),
    currency: "CNY",
    grossFen: num(row.gross_fen),
    towFen: num(row.tow_fen),
    serviceFen: num(row.service_fen),
    netFen: num(row.net_fen),
    conditions: (row.conditions ?? {}) as Record<string, string>,
    demo: Boolean(row.demo),
    active: Boolean(row.active),
    profileVersion: Number(row.profile_version),
    createdAt: iso(row.created_at) ?? "",
  };
}

export function mapAppointment(row: Row): AppointmentRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    quoteId: String(row.quote_id),
    quoteVersion: Number(row.quote_version),
    profileVersion: Number(row.profile_version),
    materialsVersion: Number(row.materials_version),
    slotId: String(row.slot_id),
    location: String(row.location),
    handoverPerson: row.handover_person ? String(row.handover_person) : null,
    drivable:
      row.drivable === null || row.drivable === undefined
        ? null
        : Boolean(row.drivable),
    summary: (row.summary ?? {}) as Record<string, unknown>,
    status: String(row.status) as AppointmentRecord["status"],
    appointmentNo: String(row.appointment_no),
    idempotencyKey: String(row.idempotency_key),
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : null,
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
  };
}

export function mapEvidence(row: Row): EvidenceRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    vehicleId: String(row.vehicle_id),
    type: String(row.type) as EvidenceRecord["type"],
    source: String(row.source),
    demo: Boolean(row.demo),
    eventTime: iso(row.event_time) ?? "",
    status: String(row.status) as EvidenceRecord["status"],
    description: row.description ? String(row.description) : null,
    createdAt: iso(row.created_at) ?? "",
  };
}

export function mapSubsidy(row: Row): SubsidyContext {
  return {
    caseId: String(row.case_id),
    active: Boolean(row.active),
    status: String(row.status) as SubsidyContext["status"],
    policyYear: Number(row.policy_year),
    purchaseStage: String(row.purchase_stage ?? "not_bought") as SubsidyContext["purchaseStage"],
    plannedPurchaseRegion: row.planned_purchase_region
      ? (row.planned_purchase_region as SubsidyContext["plannedPurchaseRegion"])
      : null,
    invoiceRegion: row.invoice_region
      ? (row.invoice_region as SubsidyContext["invoiceRegion"])
      : null,
    newRegistrationProvince: row.new_registration_province
      ? String(row.new_registration_province)
      : null,
    acceptingCity: row.accepting_city ? String(row.accepting_city) : null,
    windowStatus: String(row.window_status),
    materials: (row.materials ?? []) as string[],
    updatedAt: iso(row.updated_at) ?? "",
  };
}