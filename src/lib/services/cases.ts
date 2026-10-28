import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  CoreFieldName,
  DocumentsStatus,
  FieldValue,
  Intent,
  OwnerRelation,
  RegionValue,
} from "@/lib/types";
import { CORE_FIELD_NAMES } from "@/lib/types";
import { withTransaction } from "@/lib/db";
import { cacheDeleteByPrefix } from "@/lib/cache";
import { normalizeRegion } from "@/lib/domain/regions";
import { subsidyAfterIntentChange } from "@/lib/domain/status";
import { touchedProfile } from "@/lib/domain/versions";
import {
  fieldValue,
  loadCase,
  loadFields,
} from "@/lib/services/store";
import { appendEvent } from "@/lib/services/events";
import { createQuotesInTx, regenerateQuotesInTx } from "@/lib/services/quotes";
import { buildSnapshot, syncTasks } from "@/lib/services/plan";

export type CreateCaseInput = {
  scenarioId?: string | null;
  fields: Partial<Record<CoreFieldName, { value: FieldValue; source?: string; confidence?: number }>>;
};

function validateField(field: CoreFieldName, raw: FieldValue): FieldValue {
  switch (field) {
    case "vehicleLocation":
    case "registrationLocation": {
      if (raw === null || typeof raw !== "object") return null;
      return normalizeRegion(raw as RegionValue);
    }
    case "ownerRelation": {
      if (raw === "self" || raw === "family") return raw;
      return null;
    }
    case "drivable":
      return typeof raw === "boolean" ? raw : null;
    case "intent":
      return raw === "scrap" || raw === "replace" ? raw : null;
    case "documentsStatus":
      return raw === "complete" || raw === "missing_registration" ? raw : null;
    default:
      return null;
  }
}

function fieldSource(raw: unknown): string {
  return ["text", "user", "sample", "demo", "unknown"].includes(String(raw))
    ? String(raw)
    : "unknown";
}

export async function createCase(input: CreateCaseInput): Promise<{ caseId: string; caseNo: string }> {
  const id = randomUUID();
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const caseNo = `SC-DEMO-${stamp}-${id.slice(0, 4).toUpperCase()}`;

  const normalized: Record<CoreFieldName, { value: FieldValue; source: string; confidence: number }> =
    Object.fromEntries(
      CORE_FIELD_NAMES.map((field) => {
        const raw = input.fields?.[field];
        return [
          field,
          {
            value: validateField(field, (raw?.value ?? null) as FieldValue),
            source: fieldSource(raw?.source),
            confidence: typeof raw?.confidence === "number" ? raw.confidence : 0,
          },
        ];
      }),
    ) as Record<CoreFieldName, { value: FieldValue; source: string; confidence: number }>;

  const intent: Intent =
    normalized.intent.value === "replace" ? "replace" : normalized.intent.value === "scrap" ? "scrap" : "unknown";

  const scenarioId =
    input.scenarioId ??
    (intent === "replace"
      ? "S3"
      : normalized.documentsStatus.value === "missing_registration"
        ? "S2"
        : "S1");

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO cases
        (id, case_no, scenario_id, schema_version, scenario_version, profile_version,
         materials_version, demo, intent)
       VALUES ($1,$2,$3,'demo-sc-v1.1','demo-sc-v1.1',1,1,true,$4)`,
      [id, caseNo, scenarioId, intent],
    );

    const vehicleId = randomUUID();
    await client.query(
      `INSERT INTO vehicles (id, case_id, demo_vehicle_no, plate_masked, energy_type, use_nature)
       VALUES ($1,$2,'DEMO VEHICLE 01','川A·DE0001','unknown','非营运')`,
      [vehicleId, id],
    );

    for (const field of CORE_FIELD_NAMES) {
      await client.query(
        `INSERT INTO case_fields (case_id, field, value, source, confirmed, confidence)
         VALUES ($1,$2,$3,$4,false,$5)`,
        [
          id,
          field,
          JSON.stringify(normalized[field].value),
          normalized[field].source,
          normalized[field].confidence,
        ],
      );
    }

    if (intent === "replace") {
      await client.query(
        `INSERT INTO subsidy_contexts
          (case_id, active, status, policy_year, window_status, materials)
         VALUES ($1, true, 'info_pending', 2026, 'unknown', '[]'::jsonb)`,
        [id],
      );
    }

    await createQuotesInTx(
      client,
      id,
      1,
      normalized.vehicleLocation.value as RegionValue | null,
      normalized.drivable.value as boolean | null,
    );

    await appendEvent(client, id, {
      type: "case_created",
      payload: {
        scenarioId,
        intent,
        vehicleLocation: normalized.vehicleLocation.value,
        registrationLocation: normalized.registrationLocation.value,
        documentsStatus: normalized.documentsStatus.value,
        demo: true,
      },
      source: "rule",
      demo: true,
    });
    await appendEvent(client, id, {
      type: "route_generated",
      payload: { scenarioId, demo: true },
      source: "rule",
      demo: true,
    });
  });

  await syncTasks(id);
  return { caseId: id, caseNo };
}

export async function getCaseSnapshot(caseId: string) {
  return buildSnapshot(caseId);
}

export async function updateField(
  caseId: string,
  field: CoreFieldName,
  rawValue: FieldValue,
): Promise<void> {
  const value = validateField(field, rawValue);
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    const fields = await loadFields(caseId, client);
    const old = fields.find((f) => f.field === field);
    const oldValue = old?.value ?? null;

    await client.query(
      `INSERT INTO case_fields (case_id, field, value, source, confirmed, confidence, updated_at)
       VALUES ($1,$2,$3,'user',true,1,now())
       ON CONFLICT (case_id, field)
       DO UPDATE SET value = EXCLUDED.value, source = 'user', confirmed = true,
         confidence = 1, updated_at = now()`,
      [caseId, field, JSON.stringify(value)],
    );

    let profileVersion = caseRecord.profileVersion;
    if (touchedProfile(field, oldValue, value)) {
      profileVersion += 1;
      await client.query(
        "UPDATE cases SET profile_version = $2, updated_at = now() WHERE id = $1",
        [caseId, profileVersion],
      );
      const vehicleLocation =
        field === "vehicleLocation"
          ? (value as RegionValue | null)
          : (oldValueFor(fields, "vehicleLocation") as RegionValue | null);
      const drivable =
        field === "drivable"
          ? (value as boolean | null)
          : (oldValueFor(fields, "drivable") as boolean | null);
      await regenerateQuotesInTx(client, caseId, profileVersion, vehicleLocation, drivable);
      await client.query(
        `UPDATE appointments SET status = 'needs_reconfirmation', updated_at = now()
         WHERE case_id = $1 AND status = 'booked'`,
        [caseId],
      );
    }

    if (field === "intent") {
      const intent = (value === "replace" ? "replace" : value === "scrap" ? "scrap" : "unknown") as Intent;
      await client.query("UPDATE cases SET intent = $2, updated_at = now() WHERE id = $1", [
        caseId,
        intent,
      ]);
      const subsidyRow = await client.query(
        "SELECT status FROM subsidy_contexts WHERE case_id = $1",
        [caseId],
      );
      const prevStatus = subsidyRow.rows.length
        ? String(subsidyRow.rows[0].status)
        : "inactive";
      const nextStatus = subsidyAfterIntentChange(intent, prevStatus as never);
      if (subsidyRow.rows.length === 0) {
        await client.query(
          `INSERT INTO subsidy_contexts
            (case_id, active, status, policy_year, window_status, materials)
           VALUES ($1,$2,$3,2026,'unknown','[]'::jsonb)`,
          [caseId, intent === "replace", nextStatus],
        );
      } else {
        await client.query(
          `UPDATE subsidy_contexts SET active = $2, status = $3, updated_at = now()
           WHERE case_id = $1`,
          [caseId, intent === "replace", nextStatus],
        );
      }
    }

    await appendEvent(client, caseId, {
      type: "field_corrected",
      payload: { field, oldValue, value },
      source: "user",
      demo: true,
    });

    await client.query("UPDATE cases SET updated_at = now() WHERE id = $1", [caseId]);
  });
  await syncTasks(caseId);
}

function oldValueFor(fields: Awaited<ReturnType<typeof loadFields>>, field: CoreFieldName): FieldValue {
  return fields.find((f) => f.field === field)?.value ?? null;
}

export async function confirmFields(caseId: string): Promise<void> {
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    await client.query(
      `UPDATE case_fields SET confirmed = true, updated_at = now()
       WHERE case_id = $1 AND value IS NOT NULL AND value <> 'null'::jsonb`,
      [caseId],
    );
    if (caseRecord.intent === "unknown") {
      const intent = await client.query(
        "SELECT value FROM case_fields WHERE case_id = $1 AND field = 'intent'",
        [caseId],
      );
      const v = intent.rows[0]?.value;
      if (v === "replace" || v === "scrap") {
        await client.query("UPDATE cases SET intent = $2, updated_at = now() WHERE id = $1", [
          caseId,
          v,
        ]);
      }
    }
    await appendEvent(client, caseId, {
      type: "field_confirmed",
      payload: { fields: CORE_FIELD_NAMES },
      source: "user",
      demo: true,
    });
    await client.query("UPDATE cases SET updated_at = now() WHERE id = $1", [caseId]);
  });
  await syncTasks(caseId);
}

/** 演示重置：清空业务数据与缓存，固定配置和 S3 样例保留。 */
export async function resetDemo(): Promise<void> {
  await withTransaction(async (client: PoolClient) => {
    await client.query(`
      TRUNCATE TABLE
        events, evidence, appointments, quotes, tasks, documents,
        vehicles, case_fields, cases, subsidy_contexts
      RESTART IDENTITY CASCADE
    `);
  });
  await cacheDeleteByPrefix("parse:");
  await cacheDeleteByPrefix("idem:");
}

export async function requireCase(caseId: string) {
  const state = await loadCaseStateForRoute(caseId);
  if (!state) throw new Error("未找到案件，请先在 /start 描述车辆情况。");
  return state;
}

async function loadCaseStateForRoute(caseId: string) {
  const caseRecord = await loadCase(caseId);
  if (!caseRecord) return null;
  return { case: caseRecord, fields: await loadFields(caseId) };
}

export function caseIntentValue(fields: Awaited<ReturnType<typeof loadFields>>): Intent {
  const v = fieldValue(fields, "intent");
  return v === "replace" ? "replace" : v === "scrap" ? "scrap" : "unknown";
}

export function caseOwnerRelation(fields: Awaited<ReturnType<typeof loadFields>>): OwnerRelation {
  const v = fieldValue(fields, "ownerRelation");
  return v === "self" || v === "family" ? v : "unknown";
}

export function caseDocumentsStatus(fields: Awaited<ReturnType<typeof loadFields>>): DocumentsStatus {
  const v = fieldValue(fields, "documentsStatus");
  return v === "complete" || v === "missing_registration" ? v : "unknown";
}