import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  AppointmentRecord,
  CaseField,
  CaseRecord,
  CaseSnapshot,
  DocumentRecord,
  EvidenceRecord,
  EvidenceStatus,
  Intent,
  PolicySummary,
  QuoteRecord,
  SubsidyContext,
  TaskRecord,
  TrackState,
  VehicleRecord,
} from "@/lib/types";
import {
  evaluateTasks,
  selectNextAction,
  stageNote,
  type AppointmentState,
  type PlanSnapshot,
  type SettlementState,
} from "@/lib/domain/tasks";
import {
  deriveSettlementStatus,
  deriveTracks,
} from "@/lib/domain/status";
import { missingDocResolutionValid } from "@/lib/domain/versions";
import { classifyLocations, regionLabel } from "@/lib/domain/regions";
import {
  fieldValue,
  loadActiveQuotes,
  loadAppointment,
  loadCase,
  loadDocuments,
  loadEvidence,
  loadFields,
  loadPaymentEvent,
  loadPolicy,
  loadSubsidy,
  loadTasks,
  loadVehicle,
  requiredDocumentTypes,
  type Runner,
} from "@/lib/services/store";
import { db } from "@/lib/services/store";

export type LoadedCaseState = {
  case: CaseRecord;
  fields: CaseField[];
  vehicle: VehicleRecord;
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  activeQuotes: QuoteRecord[];
  appointment: AppointmentRecord | null;
  evidence: EvidenceRecord[];
  subsidy: SubsidyContext | null;
  paymentEvent: { type: string; source: string; createdAt: string } | null;
  plan: PlanSnapshot;
  settlement: SettlementState;
  tracks: TrackState[];
  policy: PolicySummary;
};

export async function loadCaseState(
  caseId: string,
  runner?: Runner,
): Promise<LoadedCaseState | null> {
  const caseRecord = await loadCase(caseId, runner);
  if (!caseRecord) return null;
  const fields = await loadFields(caseId, runner);
  const vehicle = await loadVehicle(caseId, runner);
  const documents = await loadDocuments(caseId, runner);
  const tasks = await loadTasks(caseId, runner);
  const activeQuotes = await loadActiveQuotes(caseId, runner);
  const appointment = await loadAppointment(caseId, runner);
  const evidence = await loadEvidence(caseId, runner);
  const subsidy = await loadSubsidy(caseId, runner);
  const paymentEvent = await loadPaymentEvent(caseId, runner);
  if (!vehicle) throw new Error("案件缺少车辆记录");

  const vehicleLocation = fieldValue(fields, "vehicleLocation") as
    | { province: string | null; city: string | null }
    | null;
  const registrationLocation = fieldValue(fields, "registrationLocation") as
    | { province: string | null; city: string | null }
    | null;

  const missingTask = tasks.find((t) => t.kind === "review_missing_document");
  const missingResolutionValid =
    missingTask?.status === "resolved" &&
    missingDocResolutionValid(missingTask.resolutionVersions, {
      profileVersion: caseRecord.profileVersion,
      materialsVersion: caseRecord.materialsVersion,
      vehicleCity: vehicleLocation?.city ?? null,
      registrationCity: registrationLocation?.city ?? null,
    });

  const authTask = tasks.find((t) => t.kind === "confirm_authorization");
  const authorizationResolved =
    authTask?.status === "resolved" &&
    authTask.resolutionVersions?.profileVersion === caseRecord.profileVersion;

  const docsStatus = String(fieldValue(fields, "documentsStatus") ?? "unknown");
  const ownerRelation = String(fieldValue(fields, "ownerRelation") ?? "unknown");
  let requiredTypes = requiredDocumentTypes(ownerRelation);
  if (docsStatus === "missing_registration" && missingResolutionValid) {
    requiredTypes = requiredTypes.filter((t) => t !== "REGISTRATION_CERT");
  }
  const confirmedDocuments = documents.filter(
    (d) => requiredTypes.includes(d.type) && d.confirmed,
  ).length;

  const selectedQuote = activeQuotes.find(
    (q) => q.providerId === caseRecord.selectedQuoteProvider,
  ) ?? null;
  const selectedQuoteValid = Boolean(
    selectedQuote &&
      caseRecord.selectedQuoteVersion === selectedQuote.version &&
      selectedQuote.profileVersion === caseRecord.profileVersion &&
      selectedQuote.netFen !== null,
  );

  let appointmentStatus: AppointmentState = "none";
  if (appointment) {
    appointmentStatus =
      appointment.status === "cancelled"
        ? "cancelled"
        : appointment.status === "needs_reconfirmation" ||
            appointment.profileVersion !== caseRecord.profileVersion ||
            appointment.materialsVersion !== caseRecord.materialsVersion ||
            (selectedQuote && appointment.quoteVersion !== selectedQuote.version)
          ? "needs_reconfirmation"
          : "booked";
  }

  const handedOver = caseRecord.handedOverAt !== null;
  const evidenceStatus = (type: EvidenceRecord["type"]): EvidenceStatus | "absent" =>
    evidence.find((e) => e.type === type)?.status ?? "absent";

  const recovery = evidenceStatus("RECOVERY_CERTIFICATE");
  const deregistration = evidenceStatus("DEREGISTRATION_CERTIFICATE");

  let settlementBase: SettlementState = selectedQuoteValid ? "quote_selected" : "none";
  if (paymentEvent?.type === "payment_confirmed") settlementBase = "confirmed";
  else if (paymentEvent?.type === "payment_disputed") settlementBase = "disputed";
  else if (paymentEvent?.type === "payment_notice") settlementBase = "notice";
  const settlement = deriveSettlementStatus({
    intent: caseRecord.intent,
    quoteSelected: selectedQuoteValid,
    appointmentStatus,
    handedOver,
    recovery,
    deregistration,
    settlement: settlementBase,
    subsidyStatus: subsidy?.status ?? "inactive",
  });

  const subsidyStatus =
    caseRecord.intent === "replace"
      ? (subsidy?.status ?? "info_pending")
      : ("inactive" as const);

  const plan: PlanSnapshot = {
    specialCase: (fieldValue(fields, "specialCase") as string | null) ?? null,
    ownerRelation: ownerRelation as PlanSnapshot["ownerRelation"],
    authorizationResolved,
    documentsStatus: docsStatus,
    missingResolutionValid,
    requiredDocuments: requiredTypes.length,
    confirmedDocuments,
    selectedQuoteValid,
    appointmentStatus,
    handedOver,
    recovery,
    deregistration,
    settlement,
    intent: caseRecord.intent as Intent,
    subsidyStatus,
  };

  const tracks = deriveTracks({
    intent: caseRecord.intent as Intent,
    quoteSelected: selectedQuoteValid,
    appointmentStatus,
    handedOver,
    recovery,
    deregistration,
    settlement,
    subsidyStatus,
  });

  const policy = await loadPolicy(
    vehicleLocation?.province ?? null,
    vehicleLocation?.city ?? null,
    runner,
  );

  return {
    case: caseRecord,
    fields,
    vehicle,
    documents,
    tasks,
    activeQuotes,
    appointment,
    evidence,
    subsidy,
    paymentEvent,
    plan,
    settlement,
    tracks,
    policy,
  };
}

/**
 * 将任务表与当前事实对齐：同一案件同一 kind 只有一行；
 * 已解决但因事实变化重新出现的任务标记为 needs_reconfirmation。
 */
export async function syncTasks(
  caseId: string,
  runner?: Runner,
): Promise<TaskRecord[]> {
  const state = await loadCaseState(caseId, runner);
  if (!state) return [];
  const candidates = evaluateTasks(state.plan);
  const existing = state.tasks;
  const existingMap = new Map(existing.map((t) => [t.kind, t]));
  const candidateSet = new Set(candidates.map((c) => c.kind));
  const userResolvable = new Set([
    "unsupported_case",
    "confirm_authorization",
    "review_missing_document",
  ]);

  for (const candidate of candidates) {
    const prev = existingMap.get(candidate.kind);
    if (!prev) {
      await db(runner).query(
        `INSERT INTO tasks (id, case_id, kind, active, status, reason, owner)
         VALUES ($1, $2, $3, true, 'open', $4, $5)`,
        [randomUUID(), caseId, candidate.kind, candidate.reason, candidate.owner],
      );
      continue;
    }
    if (userResolvable.has(candidate.kind) && prev.status === "resolved") {
      await db(runner).query(
        `UPDATE tasks SET active = true, status = 'needs_reconfirmation',
           reason = $2, owner = $3,
           updated_at = now()
         WHERE id = $1`,
        [
          prev.id,
          `${candidate.reason} 已解决说明因情况或版本变化失效，请重新确认。`,
          candidate.owner,
        ],
      );
      continue;
    }
    if (prev.status === "needs_reconfirmation") {
      // 保持“需要重新确认”，直到用户重新解决或条件消失。
      continue;
    }
    if (prev.status === "resolved" || !prev.active) {
      await db(runner).query(
        `UPDATE tasks SET active = true, status = 'open', reason = $2, owner = $3,
           updated_at = now()
         WHERE id = $1`,
        [prev.id, candidate.reason, candidate.owner],
      );
    } else if (prev.reason !== candidate.reason) {
      await db(runner).query(
        `UPDATE tasks SET reason = $2, owner = $3, updated_at = now() WHERE id = $1`,
        [prev.id, candidate.reason, candidate.owner],
      );
    }
  }

  for (const task of existing) {
    if (!candidateSet.has(task.kind) && task.active) {
      await db(runner).query(
        `UPDATE tasks SET active = false, status = 'resolved', updated_at = now()
         WHERE id = $1`,
        [task.id],
      );
    }
  }

  return loadTasks(caseId, runner);
}

export async function buildSnapshot(caseId: string): Promise<CaseSnapshot | null> {
  const state = await loadCaseState(caseId);
  if (!state) return null;
  const tasks = await syncTasks(caseId);
  const selectedQuote = state.activeQuotes.find(
    (q) => q.providerId === state.case.selectedQuoteProvider,
  ) ?? null;
  const nextAction = selectNextAction(tasks);
  return {
    case: state.case,
    fields: state.fields,
    vehicle: state.vehicle,
    documents: state.documents,
    tasks,
    quotes: state.activeQuotes,
    selectedQuote,
    appointment: state.appointment,
    evidence: state.evidence,
    subsidy: state.subsidy,
    tracks: state.tracks,
    nextAction,
    stageNote: stageNote(state.plan),
    policy: state.policy,
  };
}

/** summary 中使用的地区展示，供材料/预约页面复用。 */
export function locationSummary(fields: CaseField[]): {
  vehicle: string;
  registration: string;
  relation: string;
} {
  const vehicle = fieldValue(fields, "vehicleLocation") as
    | { province: string | null; city: string | null }
    | null;
  const registration = fieldValue(fields, "registrationLocation") as
    | { province: string | null; city: string | null }
    | null;
  const relation = classifyLocations(vehicle, registration);
  const relationLabel =
    relation === "same_city"
      ? "车辆所在地与登记地相同"
      : relation === "same_province"
        ? "省内跨市州"
        : relation === "cross_province"
          ? "跨省登记"
          : "地区待确认";
  return {
    vehicle: regionLabel(vehicle),
    registration: regionLabel(registration),
    relation: relationLabel,
  };
}

export async function resolveTask(
  caseId: string,
  kind: string,
  note: string,
  source: "user" | "demo_controller" = "user",
): Promise<TaskRecord | null> {
  if (!note.trim()) throw new Error("解决说明不能为空");
  const { withTransaction } = await import("@/lib/db");
  const { appendEvent } = await import("@/lib/services/events");
  await withTransaction(async (client: PoolClient) => {
    const state = await loadCaseState(caseId, client);
    if (!state) throw new Error("案件不存在");
    const task = state.tasks.find((t) => t.kind === kind);
    if (!task) throw new Error("任务不存在");
    const vehicle = state.fields.find((f) => f.field === "vehicleLocation")?.value as
      | { city: string | null }
      | null;
    const registration = state.fields.find(
      (f) => f.field === "registrationLocation",
    )?.value as { city: string | null } | null;
    const resolution = {
      profileVersion: state.case.profileVersion,
      materialsVersion: state.case.materialsVersion,
      vehicleCity: vehicle?.city ?? null,
      registrationCity: registration?.city ?? null,
    };
    await client.query(
      `UPDATE tasks SET status = 'resolved', active = false,
         resolution_versions = $2, resolution_note = $3, updated_at = now()
       WHERE case_id = $1 AND kind = $4`,
      [caseId, JSON.stringify(resolution), note, kind],
    );
    await appendEvent(client, caseId, {
      type: "task_resolved",
      payload: { kind, note, resolution },
      source,
      demo: true,
    });
  });
  await syncTasks(caseId);
  const tasks = await loadTasks(caseId);
  return tasks.find((t) => t.kind === kind) ?? null;
}