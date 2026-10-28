import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { EvidenceType, EvidenceStatus, RegionValue, SubsidyContext } from "@/lib/types";
import { withTransaction } from "@/lib/db";
import { formatYuan } from "@/lib/domain/money";
import { loadCaseState } from "@/lib/services/plan";
import { syncTasks } from "@/lib/services/plan";
import { appendEvent, eventExists, listEvents } from "@/lib/services/events";
import {
  loadActiveAppointment,
  loadCase,
  loadEvidence,
  loadFields,
  fieldValue,
} from "@/lib/services/store";
import { resetDemo } from "@/lib/services/cases";
import { SLOTS, defaultLocation } from "@/lib/services/appointments";

export const DEMO_STAGES = [
  { id: "D1", label: "D1 已预约", description: "本地演示预约回执；不推进交接、注销或收款。" },
  { id: "D2", label: "D2 已交接", description: "演示企业交接记录；不推进注销或补贴。" },
  { id: "D3", label: "D3 回收证明已提供", description: "回收证明样例待核验；不推进注销或到账。" },
  { id: "D4", label: "D4 回收证明演示核验完成", description: "仅核验回收证明；注销与到账保持不变。" },
  { id: "D5", label: "D5 注销证明已提供", description: "注销证明待核验；不完成注销、不付款。" },
  { id: "D6", label: "D6 注销演示核验完成", description: "仅推进注销；回收款仍需确认到账。" },
  { id: "D7", label: "D7 回收款已确认到账", description: "演示用户确认事件；不推进补贴审核。" },
] as const;

export type DemoStageId = (typeof DEMO_STAGES)[number]["id"];

const STAGE_EVENT: Record<DemoStageId, string> = {
  D1: "demo_D1_appointment",
  D2: "demo_D2_handover",
  D3: "demo_D3_recovery_provided",
  D4: "demo_D4_recovery_verified",
  D5: "demo_D5_deregistration_provided",
  D6: "demo_D6_deregistration_verified",
  D7: "demo_D7_payment_confirmed",
};

async function upsertEvidence(
  client: PoolClient,
  caseId: string,
  vehicleId: string,
  type: EvidenceType,
  status: EvidenceStatus,
  description: string,
): Promise<void> {
  await client.query(
    `INSERT INTO evidence
      (id, case_id, vehicle_id, type, source, demo, event_time, status, description)
     VALUES ($1,$2,$3,$4,'demo_controller',true,now(),$5,$6)
     ON CONFLICT (case_id, vehicle_id, type)
     DO UPDATE SET status = EXCLUDED.status, source = 'demo_controller',
       demo = true, event_time = now(), description = EXCLUDED.description`,
    [randomUUID(), caseId, vehicleId, type, status, description],
  );
}

async function ensureAppointment(client: PoolClient, caseId: string): Promise<void> {
  const active = await loadActiveAppointment(caseId, client);
  if (active) return;
  const state = await loadCaseState(caseId, client);
  if (!state) throw new Error("案件不存在");
  const quote =
    state.activeQuotes.find((q) => q.providerId === state.case.selectedQuoteProvider) ??
    state.activeQuotes[0];
  if (!quote) throw new Error("没有可用演示报价，无法生成预约回执");
  if (state.case.selectedQuoteProvider !== quote.providerId) {
    await client.query(
      `UPDATE cases SET selected_quote_provider = $2, selected_quote_version = $3,
         updated_at = now() WHERE id = $1`,
      [caseId, quote.providerId, quote.version],
    );
    await appendEvent(client, caseId, {
      type: "quote_selected",
      payload: { providerId: quote.providerId, version: quote.version, demo: true },
      source: "demo_controller",
      demo: true,
    });
  }
  const fields = await loadFields(caseId, client);
  const drivableField = fieldValue(fields, "drivable");
  const location = defaultLocation(fields) || "成都·演示停车点";
  const summary = {
    providerName: quote.providerName,
    slot: "演示时段 A 上午",
    location,
    net: formatYuan(quote.netFen),
    note: "演示控制注入的预约回执；资料不会实际发送。",
  };
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const appointmentNo = `DEMO-APT-${stamp}-${randomUUID().slice(0, 4).toUpperCase()}`;
  await client.query(
    `INSERT INTO appointments
      (id, case_id, quote_id, quote_version, profile_version, materials_version,
       slot_id, location, handover_person, drivable, summary, status,
       appointment_no, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'演示车主',$9,$10,'booked',$11,$12)`,
    [
      randomUUID(),
      caseId,
      quote.id,
      quote.version,
      state.case.profileVersion,
      state.case.materialsVersion,
      SLOTS[0].id,
      location,
      typeof drivableField === "boolean" ? drivableField : null,
      JSON.stringify(summary),
      appointmentNo,
      `demo-D1-${randomUUID()}`,
    ],
  );
  await appendEvent(client, caseId, {
    type: "appointment_confirmed",
    payload: { appointmentNo, slotId: SLOTS[0].id, source: "demo_controller", demo: true },
    source: "demo_controller",
    demo: true,
  });
}

export async function injectDemoStage(
  caseId: string,
  stage: DemoStageId,
): Promise<{ applied: boolean; message: string }> {
  if (!(stage in STAGE_EVENT)) throw new Error("未知演示阶段");

  const already = await eventExists(caseId, STAGE_EVENT[stage]);
  if (already) {
    return { applied: false, message: `${stage} 已注入过，状态保持不变。` };
  }

  const message = await withTransaction(async (client) => {
    const state = await loadCaseState(caseId, client);
    if (!state) throw new Error("案件不存在");
    const vehicleId = state.vehicle.id;

    switch (stage) {
      case "D1": {
        await ensureAppointment(client, caseId);
        break;
      }
      case "D2": {
        await ensureAppointment(client, caseId);
        await client.query(
          `UPDATE cases SET handed_over_at = COALESCE(handed_over_at, now()),
             updated_at = now() WHERE id = $1`,
          [caseId],
        );
        await upsertEvidence(
          client,
          caseId,
          vehicleId,
          "HANDOVER_RECEIPT",
          "provided",
          "演示企业交接回执；仅证明车辆已交接，不代表注销完成。",
        );
        break;
      }
      case "D3": {
        await upsertEvidence(
          client,
          caseId,
          vehicleId,
          "RECOVERY_CERTIFICATE",
          "provided",
          "演示回收证明样例，等待核验；不推进注销或收款。",
        );
        break;
      }
      case "D4": {
        const evidence = await loadEvidence(caseId, client);
        const rec = evidence.find((e) => e.type === "RECOVERY_CERTIFICATE");
        if (!rec) throw new Error("请先注入 D3（回收证明已提供）。");
        await upsertEvidence(
          client,
          caseId,
          vehicleId,
          "RECOVERY_CERTIFICATE",
          "demo_verified",
          "演示核验事件：回收证明信息与本案演示车辆匹配。",
        );
        break;
      }
      case "D5": {
        await upsertEvidence(
          client,
          caseId,
          vehicleId,
          "DEREGISTRATION_CERTIFICATE",
          "provided",
          "演示注销证明样例，已提供待核验；交车与回收证明不等于注销完成。",
        );
        break;
      }
      case "D6": {
        const evidence = await loadEvidence(caseId, client);
        const dereg = evidence.find((e) => e.type === "DEREGISTRATION_CERTIFICATE");
        if (!dereg) throw new Error("请先注入 D5（注销证明已提供）。");
        await upsertEvidence(
          client,
          caseId,
          vehicleId,
          "DEREGISTRATION_CERTIFICATE",
          "demo_verified",
          "演示核验事件：注销证明与本案演示车辆匹配。回收款仍需确认到账。",
        );
        break;
      }
      case "D7": {
        await appendEvent(client, caseId, {
          type: "payment_confirmed",
          payload: {
            note: "演示控制注入的到账确认；仍保持演示身份，不代表真实到账。",
            demo: true,
          },
          source: "demo_controller",
          demo: true,
        });
        break;
      }
    }

    await appendEvent(client, caseId, {
      type: STAGE_EVENT[stage],
      payload: { stage, demo: true, source: "demo_controller" },
      source: "demo_controller",
      demo: true,
    });
    await client.query("UPDATE cases SET updated_at = now() WHERE id = $1", [caseId]);
    return `${stage} 已注入（演示控制）。`;
  });

  await syncTasks(caseId);
  return { applied: true, message };
}

/** 企业付款反馈：只记录通知，不等于车主到账。 */
export async function recordPaymentNotice(caseId: string): Promise<void> {
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    await appendEvent(client, caseId, {
      type: "payment_notice",
      payload: {
        note: "演示企业反馈已付款；等待车主确认到账。",
        demo: true,
      },
      source: "demo_controller",
      demo: true,
    });
  });
  await syncTasks(caseId);
}

/** 用户显式确认到账：付款通知本身不会推进。 */
export async function confirmPayment(caseId: string): Promise<void> {
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    if (!caseRecord.handedOverAt) throw new Error("车辆尚未交接，不能确认到账。");
    await appendEvent(client, caseId, {
      type: "payment_confirmed",
      payload: { note: "车主本人确认已收到回收款（演示）。", demo: true },
      source: "user",
      demo: true,
    });
  });
  await syncTasks(caseId);
}

export async function resetAllDemo(): Promise<void> {
  await resetDemo();
}

export async function exportDemoRecord(caseId: string) {
  const state = await loadCaseState(caseId);
  if (!state) throw new Error("案件不存在");
  const events = await listEvents(caseId);
  const region = (field: string): RegionValue | null =>
    (fieldValue(state.fields, field as never) as RegionValue | null) ?? null;
  const subsidy: SubsidyContext | null = state.subsidy;
  return {
    exportedAt: new Date().toISOString(),
    demo: true,
    scenarioVersion: state.case.scenarioVersion,
    disclaimer: "本地测试记录，不含真实个人信息、证件图像或完整自由文本。",
    case: {
      id: state.case.id,
      caseNo: state.case.caseNo,
      scenarioId: state.case.scenarioId,
      intent: state.case.intent,
      profileVersion: state.case.profileVersion,
      materialsVersion: state.case.materialsVersion,
      demoVehicleNo: state.vehicle.demoVehicleNo,
    },
    fields: state.fields.map((f) => ({
      field: f.field,
      value: f.value,
      source: f.source,
      confirmed: f.confirmed,
    })),
    regions: {
      vehicle: region("vehicleLocation"),
      registration: region("registrationLocation"),
    },
    documents: state.documents.map((d) => ({
      type: d.type,
      sampleId: d.sampleId,
      quality: d.quality,
      confirmed: d.confirmed,
      issues: d.issues,
    })),
    quotes: state.activeQuotes,
    appointment: state.appointment,
    evidence: state.evidence,
    tasks: state.tasks,
    subsidy,
    events: events.map((e) => ({
      sequence: e.sequence,
      type: e.type,
      source: e.source,
      demo: e.demo,
      createdAt: e.createdAt,
      payload: e.payload,
    })),
  };
}

