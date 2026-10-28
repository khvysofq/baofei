import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  canChangeBooking,
  deriveSettlementStatus,
} from "@/lib/domain/status";
import { formatYuan } from "@/lib/domain/money";
import type {
  AppointmentRecord,
  CaseField,
  EvidenceStatus,
  Intent,
  QuoteRecord,
  RegionValue,
} from "@/lib/types";
import { withTransaction } from "@/lib/db";
import { cacheGet, cacheSet, idemKey } from "@/lib/cache";
import { fieldValue, loadActiveAppointment, loadCase, loadFields } from "@/lib/services/store";
import { appendEvent } from "@/lib/services/events";
import { loadCaseState, syncTasks } from "@/lib/services/plan";

export const SLOTS = [
  { id: "DEMO_SLOT_A", label: "上午 09:00–12:00", window: "09:00–12:00" },
  { id: "DEMO_SLOT_B", label: "下午 13:00–17:00", window: "13:00–17:00" },
] as const;

export function defaultLocation(fields: CaseField[]): string {
  const region = fieldValue(fields, "vehicleLocation") as RegionValue | null;
  if (!region?.city) return "";
  return `${region.city}·车辆停放点`;
}

function slotLabel(slotId: string): string {
  return SLOTS.find((s) => s.id === slotId)?.label ?? "时段待确认";
}

function drivableLabel(value: boolean | null): string {
  if (value === true) return "可正常行驶";
  if (value === false) return "开不动，需要拖运";
  return "行驶状况待确认";
}

export type AppointmentSummary = {
  providerName: string;
  slot: string;
  location: string;
  vehicleStatus: string;
  drivable: boolean | null;
  handoverPerson: string;
  materials: string[];
  fees: { gross: string; tow: string; service: string; net: string };
  note: string;
};

function materialsList(fields: CaseField[]): string[] {
  const ownerRelation = fieldValue(fields, "ownerRelation");
  const base = ["行驶证", "登记证（绿本）"];
  if (ownerRelation === "family") base.push("车主授权与代办核对");
  return base;
}

function buildSummary(
  quote: QuoteRecord,
  fields: CaseField[],
  slotId: string,
  location: string,
  drivable: boolean | null,
  handoverPerson: string,
): AppointmentSummary {
  return {
    providerName: quote.providerName,
    slot: slotLabel(slotId),
    location: location || "待选择",
    vehicleStatus: drivableLabel(drivable),
    drivable,
    handoverPerson,
    materials: materialsList(fields),
    fees: {
      gross: formatYuan(quote.grossFen),
      tow: formatYuan(quote.towFen),
      service: formatYuan(quote.serviceFen),
      net: formatYuan(quote.netFen),
    },
    note: "资料发送项目以本摘要为准；预约记录保存在办理档案中。",
  };
}

export async function getAppointmentView(caseId: string) {
  const state = await loadCaseState(caseId);
  if (!state) throw new Error("案件不存在");
  const active = state.appointment && state.appointment.status !== "cancelled"
    ? state.appointment
    : null;
  const quote =
    state.activeQuotes.find((q) => q.providerId === state.case.selectedQuoteProvider) ?? null;
  const drivableField = fieldValue(state.fields, "drivable");
  const drivable = typeof drivableField === "boolean" ? drivableField : null;

  const materials = materialsList(state.fields);
  const missingResolved = state.plan.missingResolutionValid;
  const docsReady = state.plan.confirmedDocuments >= state.plan.requiredDocuments;

  return {
    appointment: active,
    cancelled: state.appointment?.status === "cancelled" ? state.appointment : null,
    quote,
    slots: SLOTS,
    defaultLocation: defaultLocation(state.fields),
    drivable,
    handoverPerson: active?.handoverPerson ?? "车主本人",
    materials,
    missingTask: state.plan.documentsStatus === "missing_registration" && !missingResolved
      ? state.tasks.find((t) => t.kind === "review_missing_document") ?? null
      : null,
    docsReady,
    handedOver: state.case.handedOverAt !== null,
    canConfirm:
      Boolean(quote) &&
      state.plan.selectedQuoteValid &&
      docsReady &&
      !state.case.handedOverAt,
    summary:
      quote && active
        ? buildSummary(
            quote,
            state.fields,
            active.slotId,
            active.location,
            active.drivable,
            active.handoverPerson ?? "车主本人",
          )
        : quote
          ? buildSummary(
              quote,
              state.fields,
              SLOTS[0].id,
              defaultLocation(state.fields),
              drivable,
              "车主本人",
            )
          : null,
    profileVersion: state.case.profileVersion,
    materialsVersion: state.case.materialsVersion,
    nextAction: state.tasks
      .filter((t) => t.active && (t.status === "open" || t.status === "needs_reconfirmation"))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null,
  };
}

export type ConfirmAppointmentInput = {
  caseId: string;
  idempotencyKey: string;
  slotId: string;
  location: string;
  handoverPerson: string;
  drivable: boolean | null;
};

async function validateBooking(client: PoolClient, caseId: string) {
  const state = await loadCaseState(caseId, client);
  if (!state) throw new Error("案件不存在");
  if (state.case.handedOverAt) {
    throw new Error("车辆已交接，不能重订或重选；请通过更正任务处理。");
  }
  const unconfirmed = state.fields.filter(
    (f) => f.value !== null && !f.confirmed,
  );
  if (unconfirmed.length > 0) {
    throw new Error("还有未确认的情况字段，请先在计划页确认。");
  }
  if (state.plan.documentsStatus === "missing_registration" && !state.plan.missingResolutionValid) {
    throw new Error("登记证缺失的核对任务尚未解决，不能确认预约。");
  }
  if (state.plan.confirmedDocuments < state.plan.requiredDocuments) {
    throw new Error("材料尚未全部确认，请先完成材料预检。");
  }
  if (!state.plan.selectedQuoteValid) {
    throw new Error("报价尚未确认或已过期，请返回报价页重新选择。");
  }
  const quote = state.activeQuotes.find(
    (q) => q.providerId === state.case.selectedQuoteProvider,
  );
  if (!quote || quote.netFen === null) {
    throw new Error("预估实收待确认，不能提交预约。");
  }
  return { state, quote };
}

export async function confirmAppointment(
  input: ConfirmAppointmentInput,
): Promise<AppointmentRecord> {
  const { caseId, idempotencyKey } = input;
  if (!idempotencyKey) throw new Error("缺少 idempotencyKey");
  if (!SLOTS.some((s) => s.id === input.slotId)) throw new Error("请选择预约时段");
  if (!input.location.trim()) throw new Error("请选择车辆停放点");
  if (!input.handoverPerson.trim()) throw new Error("请填写交接人");

  const cachedId = await cacheGet(idemKey(idempotencyKey));
  if (cachedId) {
    const existing = await withTransaction(async (client) => {
      const r = await client.query("SELECT * FROM appointments WHERE id = $1", [cachedId]);
      return r.rows.length ? mapAppointmentRow(r.rows[0]) : null;
    });
    if (existing) return existing;
  }

  const result = await withTransaction(async (client) => {
    const lockedCase = await loadCase(caseId, client);
    if (!lockedCase) throw new Error("案件不存在");

    const byKey = await client.query(
      "SELECT * FROM appointments WHERE case_id = $1 AND idempotency_key = $2",
      [caseId, idempotencyKey],
    );
    if (byKey.rows.length) return mapAppointmentRow(byKey.rows[0]);

    const { state, quote } = await validateBooking(client, caseId);

    const active = await loadActiveAppointment(caseId, client);
    const summary = buildSummary(
      quote,
      state.fields,
      input.slotId,
      input.location,
      input.drivable,
      input.handoverPerson,
    );
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const appointmentNo = `SC-APT-${stamp}-${randomUUID().slice(0, 4).toUpperCase()}`;

    let appointment: AppointmentRecord;
    if (active && active.status === "needs_reconfirmation") {
      const updated = await client.query(
        `UPDATE appointments SET quote_id = $2, quote_version = $3,
           profile_version = $4, materials_version = $5, slot_id = $6,
           location = $7, handover_person = $8, drivable = $9, summary = $10,
           status = 'booked', updated_at = now()
         WHERE id = $1 RETURNING *`,
        [
          active.id,
          quote.id,
          quote.version,
          state.case.profileVersion,
          state.case.materialsVersion,
          input.slotId,
          input.location,
          input.handoverPerson,
          input.drivable,
          JSON.stringify(summary),
        ],
      );
      appointment = mapAppointmentRow(updated.rows[0]);
      await appendEvent(client, caseId, {
        type: "appointment_reconfirmed",
        payload: {
          appointmentNo: appointment.appointmentNo,
          quoteVersion: quote.version,
          profileVersion: state.case.profileVersion,
          materialsVersion: state.case.materialsVersion,
        },
        source: "user",
        demo: true,
      });
    } else if (active && active.status === "booked") {
      const updated = await client.query(
        `UPDATE appointments SET slot_id = $2, location = $3,
           handover_person = $4, drivable = $5, summary = $6,
           profile_version = $7, materials_version = $8, quote_version = $9,
           quote_id = $10, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [
          active.id,
          input.slotId,
          input.location,
          input.handoverPerson,
          input.drivable,
          JSON.stringify(summary),
          state.case.profileVersion,
          state.case.materialsVersion,
          quote.version,
          quote.id,
        ],
      );
      appointment = mapAppointmentRow(updated.rows[0]);
      await appendEvent(client, caseId, {
        type: "appointment_updated",
        payload: { appointmentNo: appointment.appointmentNo, slotId: input.slotId },
        source: "user",
        demo: true,
      });
    } else {
      const inserted = await client.query(
        `INSERT INTO appointments
          (id, case_id, quote_id, quote_version, profile_version, materials_version,
           slot_id, location, handover_person, drivable, summary, status,
           appointment_no, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'booked',$12,$13)
         RETURNING *`,
        [
          randomUUID(),
          caseId,
          quote.id,
          quote.version,
          state.case.profileVersion,
          state.case.materialsVersion,
          input.slotId,
          input.location,
          input.handoverPerson,
          input.drivable,
          JSON.stringify(summary),
          appointmentNo,
          idempotencyKey,
        ],
      );
      appointment = mapAppointmentRow(inserted.rows[0]);
      await appendEvent(client, caseId, {
        type: "appointment_confirmed",
        payload: {
          appointmentNo,
          providerId: quote.providerId,
          quoteVersion: quote.version,
          slotId: input.slotId,
          netFen: quote.netFen,
          demo: true,
        },
        source: "user",
        demo: true,
      });
    }

    await client.query("UPDATE cases SET updated_at = now() WHERE id = $1", [caseId]);
    return appointment;
  });

  await cacheSet(idemKey(idempotencyKey), result.id, 24 * 60 * 60);
  await syncTasks(caseId);
  return result;
}

export async function rescheduleAppointment(
  caseId: string,
  input: { slotId: string; location?: string; handoverPerson?: string; drivable?: boolean | null },
): Promise<AppointmentRecord> {
  if (!SLOTS.some((s) => s.id === input.slotId)) throw new Error("请选择预约时段");
  const result = await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    if (!canChangeBooking(caseRecord.handedOverAt !== null)) {
      throw new Error("车辆已交接，不能修改或取消预约。");
    }
    const active = await loadActiveAppointment(caseId, client);
    if (!active) throw new Error("没有可修改的预约");
    const fields = await loadFields(caseId, client);
    const quoteRow = await client.query("SELECT * FROM quotes WHERE id = $1", [active.quoteId]);
    if (quoteRow.rows.length === 0) throw new Error("预约关联的报价不存在");
    const quote = mapQuoteRow(quoteRow.rows[0]);
    const location = input.location?.trim() || active.location;
    const handoverPerson = input.handoverPerson?.trim() || active.handoverPerson || "车主本人";
    const drivable = input.drivable === undefined ? active.drivable : input.drivable;
    const summary = buildSummary(quote, fields, input.slotId, location, drivable, handoverPerson);
    const updated = await client.query(
      `UPDATE appointments SET slot_id = $2, location = $3, handover_person = $4,
         drivable = $5, summary = $6, status = 'booked', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [active.id, input.slotId, location, handoverPerson, drivable, JSON.stringify(summary)],
    );
    await appendEvent(client, caseId, {
      type: "appointment_rescheduled",
      payload: { appointmentNo: active.appointmentNo, slotId: input.slotId },
      source: "user",
      demo: true,
    });
    return mapAppointmentRow(updated.rows[0]);
  });
  await syncTasks(caseId);
  return result;
}

export async function cancelAppointment(
  caseId: string,
  reason = "用户取消",
): Promise<AppointmentRecord> {
  const result = await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    if (!canChangeBooking(caseRecord.handedOverAt !== null)) {
      throw new Error("车辆已交接，禁用常规取消；请通过更正任务处理。");
    }
    const active = await loadActiveAppointment(caseId, client);
    if (!active) throw new Error("没有可取消的预约");
    const updated = await client.query(
      `UPDATE appointments SET status = 'cancelled', cancel_reason = $2,
         updated_at = now() WHERE id = $1 RETURNING *`,
      [active.id, reason],
    );
    await appendEvent(client, caseId, {
      type: "appointment_cancelled",
      payload: { appointmentNo: active.appointmentNo, reason, note: "材料保留，车辆未标为已交接。" },
      source: "user",
      demo: true,
    });
    return mapAppointmentRow(updated.rows[0]);
  });
  await syncTasks(caseId);
  return result;
}

function mapAppointmentRow(row: Record<string, unknown>): AppointmentRecord {
  const iso = (v: unknown) =>
    v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
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
    drivable: row.drivable === null || row.drivable === undefined ? null : Boolean(row.drivable),
    summary: (row.summary ?? {}) as Record<string, unknown>,
    status: String(row.status) as AppointmentRecord["status"],
    appointmentNo: String(row.appointment_no),
    idempotencyKey: String(row.idempotency_key),
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapQuoteRow(row: Record<string, unknown>): QuoteRecord {
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
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

// 供状态派生复用，避免调用方各自解释付款事件。
export function currentSettlement(
  handedOver: boolean,
  quoteSelected: boolean,
  paymentType: string | null,
): string {
  return deriveSettlementStatus({
    intent: "scrap" as Intent,
    quoteSelected,
    appointmentStatus: "none",
    handedOver,
    recovery: "absent" as EvidenceStatus,
    deregistration: "absent" as EvidenceStatus,
    settlement:
      paymentType === "payment_confirmed"
        ? "confirmed"
        : paymentType === "payment_notice"
          ? "notice"
          : paymentType === "payment_disputed"
            ? "disputed"
            : quoteSelected
              ? "quote_selected"
              : "none",
    subsidyStatus: "inactive",
  });
}