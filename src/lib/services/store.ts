import type { Pool, PoolClient, QueryResult } from "pg";
import { getPool } from "@/lib/db";
import type {
  AppointmentRecord,
  CaseField,
  CaseRecord,
  DocumentRecord,
  EvidenceRecord,
  PolicySummary,
  QuoteRecord,
  SubsidyContext,
  TaskRecord,
  VehicleRecord,
} from "@/lib/types";
import {
  mapAppointment,
  mapCase,
  mapDocument,
  mapEvidence,
  mapField,
  mapQuote,
  mapSubsidy,
  mapTask,
  mapVehicle,
} from "@/lib/services/mappers";

export type Runner = Pick<Pool | PoolClient, "query">;

export function db(runner?: Runner): Runner {
  return runner ?? getPool();
}

async function rows(
  runner: Runner | undefined,
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const result: QueryResult = await db(runner).query(sql, params);
  return result.rows;
}

export async function loadCase(
  caseId: string,
  runner?: Runner,
): Promise<CaseRecord | null> {
  const r = await rows(runner, "SELECT * FROM cases WHERE id = $1", [caseId]);
  return r.length ? mapCase(r[0]) : null;
}

export async function lockCase(
  caseId: string,
  client: PoolClient,
): Promise<CaseRecord | null> {
  const r = await client.query("SELECT * FROM cases WHERE id = $1 FOR UPDATE", [caseId]);
  return r.rows.length ? mapCase(r.rows[0]) : null;
}

export async function loadFields(
  caseId: string,
  runner?: Runner,
): Promise<CaseField[]> {
  const r = await rows(runner, "SELECT * FROM case_fields WHERE case_id = $1", [caseId]);
  return r.map(mapField);
}

export function fieldValue(
  fields: CaseField[],
  name: CaseField["field"],
): CaseField["value"] {
  return fields.find((f) => f.field === name)?.value ?? null;
}

export function fieldConfirmed(
  fields: CaseField[],
  name: CaseField["field"],
): boolean {
  return fields.find((f) => f.field === name)?.confirmed ?? false;
}

export async function loadVehicle(
  caseId: string,
  runner?: Runner,
): Promise<VehicleRecord | null> {
  const r = await rows(runner, "SELECT * FROM vehicles WHERE case_id = $1", [caseId]);
  return r.length ? mapVehicle(r[0]) : null;
}

export async function loadDocuments(
  caseId: string,
  runner?: Runner,
): Promise<DocumentRecord[]> {
  const r = await rows(runner, "SELECT * FROM documents WHERE case_id = $1 ORDER BY type", [
    caseId,
  ]);
  return r.map(mapDocument);
}

export async function loadTasks(
  caseId: string,
  runner?: Runner,
): Promise<TaskRecord[]> {
  const r = await rows(runner, "SELECT * FROM tasks WHERE case_id = $1", [caseId]);
  return r.map(mapTask);
}

export async function loadActiveQuotes(
  caseId: string,
  runner?: Runner,
): Promise<QuoteRecord[]> {
  const r = await rows(
    runner,
    "SELECT * FROM quotes WHERE case_id = $1 AND active = true ORDER BY provider_id",
    [caseId],
  );
  return r.map(mapQuote);
}

export async function loadAllQuotes(
  caseId: string,
  runner?: Runner,
): Promise<QuoteRecord[]> {
  const r = await rows(
    runner,
    "SELECT * FROM quotes WHERE case_id = $1 ORDER BY provider_id, version",
    [caseId],
  );
  return r.map(mapQuote);
}

export async function loadSelectedQuote(
  caseRecord: CaseRecord,
  runner?: Runner,
): Promise<QuoteRecord | null> {
  if (!caseRecord.selectedQuoteProvider || caseRecord.selectedQuoteVersion === null) {
    return null;
  }
  const r = await rows(
    runner,
    `SELECT * FROM quotes
     WHERE case_id = $1 AND provider_id = $2 AND version = $3`,
    [
      caseRecord.id,
      caseRecord.selectedQuoteProvider,
      caseRecord.selectedQuoteVersion,
    ],
  );
  return r.length ? mapQuote(r[0]) : null;
}

export async function loadAppointment(
  caseId: string,
  runner?: Runner,
): Promise<AppointmentRecord | null> {
  const r = await rows(
    runner,
    "SELECT * FROM appointments WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
    [caseId],
  );
  return r.length ? mapAppointment(r[0]) : null;
}

export async function loadActiveAppointment(
  caseId: string,
  runner?: Runner,
): Promise<AppointmentRecord | null> {
  const r = await rows(
    runner,
    `SELECT * FROM appointments
     WHERE case_id = $1 AND status <> 'cancelled'
     ORDER BY created_at DESC LIMIT 1`,
    [caseId],
  );
  return r.length ? mapAppointment(r[0]) : null;
}

export async function loadEvidence(
  caseId: string,
  runner?: Runner,
): Promise<EvidenceRecord[]> {
  const r = await rows(
    runner,
    "SELECT * FROM evidence WHERE case_id = $1 ORDER BY created_at",
    [caseId],
  );
  return r.map(mapEvidence);
}

export async function loadSubsidy(
  caseId: string,
  runner?: Runner,
): Promise<SubsidyContext | null> {
  const r = await rows(runner, "SELECT * FROM subsidy_contexts WHERE case_id = $1", [
    caseId,
  ]);
  return r.length ? mapSubsidy(r[0]) : null;
}

export type PaymentEvent = {
  type: string;
  source: string;
  createdAt: string;
} | null;

export async function loadPaymentEvent(
  caseId: string,
  runner?: Runner,
): Promise<PaymentEvent> {
  const r = await rows(
    runner,
    `SELECT type, source, created_at FROM events
     WHERE case_id = $1
       AND type IN ('payment_notice', 'payment_confirmed', 'payment_disputed')
     ORDER BY sequence DESC LIMIT 1`,
    [caseId],
  );
  if (!r.length) return null;
  return {
    type: String(r[0].type),
    source: String(r[0].source),
    createdAt: new Date(r[0].created_at as string).toISOString(),
  };
}

export async function loadPolicy(
  province: string | null,
  city: string | null,
  runner?: Runner,
): Promise<PolicySummary> {
  const all = await rows(runner, "SELECT * FROM city_policy_config ORDER BY id", []);
  const mapped = all.map((row) => ({
    region: String(row.region),
    scope: String(row.scope),
    sourceIds: (row.source_ids ?? []) as string[],
    checkedAt: row.checked_at
      ? new Date(row.checked_at as string).toISOString().slice(0, 10)
      : "",
    notes: row.notes ? String(row.notes) : "",
    status: String(row.status),
    aliases: (row.aliases ?? []) as string[],
  }));
  const national = mapped.find((p) => p.scope === "national");
  const provinceRow = province
    ? mapped.find((p) => p.scope === "province" && p.region === province)
    : undefined;
  const cityRow = city
    ? mapped.find((p) => p.scope === "city" && p.region === city)
    : undefined;

  if (cityRow) {
    return {
      region: `${province ?? ""}·${city}`,
      scope: "city",
      status: cityRow.status,
      statusLabel:
        cityRow.status === "verified"
          ? "已有依据"
          : "已有依据，受理细节待核实",
      sourceIds: [...(provinceRow?.sourceIds ?? []), ...cityRow.sourceIds],
      checkedAt: cityRow.checkedAt || provinceRow?.checkedAt || national?.checkedAt || "",
      notes: cityRow.notes,
      cityKnown: true,
    };
  }
  if (provinceRow) {
    return {
      region: city ? `${province ?? ""}·${city}` : (province ?? ""),
      scope: "province",
      status: city ? "unverified_city" : "verified",
      statusLabel: city ? "该市州本地规则待核实" : "省级依据已有",
      sourceIds: provinceRow.sourceIds,
      checkedAt: provinceRow.checkedAt,
      notes: city
        ? `尚未核对 ${city} 的市级受理细节，本页不套用成都要求，也不承诺服务范围。`
        : provinceRow.notes,
      cityKnown: !!city,
    };
  }
  return {
    region: province ?? "待确认",
    scope: "national",
    status: "unverified",
    statusLabel: "待核实",
    sourceIds: national?.sourceIds ?? [],
    checkedAt: national?.checkedAt ?? "",
    notes: "所在地尚未确认，只能参考国家规则；本地受理细节待核实。",
    cityKnown: false,
  };
}

export function requiredDocumentTypes(
  ownerRelation: string,
): DocumentRecord["type"][] {
  if (ownerRelation === "family") {
    return ["DRIVING_LICENSE", "REGISTRATION_CERT", "AUTHORIZATION"];
  }
  return ["DRIVING_LICENSE", "REGISTRATION_CERT"];
}