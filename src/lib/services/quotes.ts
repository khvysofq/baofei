import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { calcNetFen } from "@/lib/domain/money";
import type { QuoteRecord, RegionValue } from "@/lib/types";
import { loadActiveQuotes, loadCase, loadFields, fieldValue } from "@/lib/services/store";
import { withTransaction } from "@/lib/db";
import { appendEvent } from "@/lib/services/events";
import { syncTasks } from "@/lib/services/plan";

type TemplateRow = {
  provider_id: string;
  name: string;
  gross_fen: number;
  tow_fen: number;
  service_fen: number;
  conditions: Record<string, string>;
};

function towCondition(
  towFen: number | null,
  templateTowFen: number,
  drivable: boolean | null,
): string {
  if (towFen === null) return "拖运条件待确认（所在地或行驶状况未知）";
  if (drivable === false) {
    return templateTowFen > 0
      ? `开不动，含拖运费 ¥${(templateTowFen / 100).toFixed(0)}`
      : "开不动；本档免费拖运";
  }
  if (drivable === true) return "车辆可行驶，不计拖车费";
  return "拖运条件待确认（行驶状况未知）";
}

function regionText(region: RegionValue | null): string {
  if (!region?.province) return "所在地待确认";
  if (!region.city) return `${region.province}·市州待确认`;
  return `${region.province}·${region.city}`;
}

export function quoteFees(
  template: { grossFen: number; towFen: number; serviceFen: number },
  vehicleLocation: RegionValue | null,
  drivable: boolean | null,
): { grossFen: number; towFen: number | null; serviceFen: number; netFen: number | null } {
  let towFen: number | null;
  if (!vehicleLocation?.city) towFen = null;
  else if (drivable === false) towFen = template.towFen;
  else if (drivable === true) towFen = 0;
  else towFen = null;

  const netFen = calcNetFen({
    grossFen: template.grossFen,
    towFen,
    serviceFen: template.serviceFen,
  });
  return {
    grossFen: template.grossFen,
    towFen,
    serviceFen: template.serviceFen,
    netFen,
  };
}

async function loadTemplates(client: PoolClient): Promise<TemplateRow[]> {
  const result = await client.query(
    "SELECT provider_id, name, gross_fen, tow_fen, service_fen, conditions FROM quote_templates ORDER BY provider_id",
  );
  return result.rows.map((row) => ({
    provider_id: String(row.provider_id),
    name: String(row.name),
    gross_fen: Number(row.gross_fen),
    tow_fen: Number(row.tow_fen),
    service_fen: Number(row.service_fen),
    conditions: (row.conditions ?? {}) as Record<string, string>,
  }));
}

export async function createQuotesInTx(
  client: PoolClient,
  caseId: string,
  profileVersion: number,
  vehicleLocation: RegionValue | null,
  drivable: boolean | null,
): Promise<QuoteRecord[]> {
  const templates = await loadTemplates(client);
  const inserted: QuoteRecord[] = [];
  for (const t of templates) {
    const fees = quoteFees(
      { grossFen: t.gross_fen, towFen: t.tow_fen, serviceFen: t.service_fen },
      vehicleLocation,
      drivable,
    );
    const id = randomUUID();
    const conditions = {
      ...t.conditions,
      area: regionText(vehicleLocation),
      tow: towCondition(fees.towFen, t.tow_fen, drivable),
      note: "预估金额，以现场验车与合同为准。",
    };
    const result = await client.query(
      `INSERT INTO quotes
        (id, case_id, provider_id, provider_name, version, currency,
         gross_fen, tow_fen, service_fen, net_fen, conditions, demo, active, profile_version)
       VALUES ($1,$2,$3,$4,$5,'CNY',$6,$7,$8,$9,$10,true,true,$11)
       RETURNING *`,
      [
        id,
        caseId,
        t.provider_id,
        t.name,
        1,
        fees.grossFen,
        fees.towFen,
        fees.serviceFen,
        fees.netFen,
        JSON.stringify(conditions),
        profileVersion,
      ],
    );
    inserted.push(mapRow(result.rows[0]));
  }
  return inserted;
}

function mapRow(row: Record<string, unknown>): QuoteRecord {
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

/** 车辆所在地或行驶状况变化后：旧版本保留，生成新版本并要求重新确认。 */
export async function regenerateQuotesInTx(
  client: PoolClient,
  caseId: string,
  profileVersion: number,
  vehicleLocation: RegionValue | null,
  drivable: boolean | null,
): Promise<void> {
  await client.query(
    "UPDATE quotes SET active = false WHERE case_id = $1 AND active = true",
    [caseId],
  );
  const templates = await loadTemplates(client);
  for (const t of templates) {
    const max = await client.query(
      "SELECT COALESCE(MAX(version), 0) AS v FROM quotes WHERE case_id = $1 AND provider_id = $2",
      [caseId, t.provider_id],
    );
    const version = Number(max.rows[0].v) + 1;
    const fees = quoteFees(
      { grossFen: t.gross_fen, towFen: t.tow_fen, serviceFen: t.service_fen },
      vehicleLocation,
      drivable,
    );
    const conditions = {
      ...t.conditions,
      area: regionText(vehicleLocation),
      tow: towCondition(fees.towFen, t.tow_fen, drivable),
      note: "预估金额，以现场验车与合同为准。",
      versionNote: "因车辆所在地或行驶状况变化，报价已重新生成，请重新确认。",
    };
    await client.query(
      `INSERT INTO quotes
        (id, case_id, provider_id, provider_name, version, currency,
         gross_fen, tow_fen, service_fen, net_fen, conditions, demo, active, profile_version)
       VALUES ($1,$2,$3,$4,$5,'CNY',$6,$7,$8,$9,$10,true,true,$11)`,
      [
        randomUUID(),
        caseId,
        t.provider_id,
        t.name,
        version,
        fees.grossFen,
        fees.towFen,
        fees.serviceFen,
        fees.netFen,
        JSON.stringify(conditions),
        profileVersion,
      ],
    );
  }
}

export async function listQuotes(caseId: string) {
  const [caseRecord, quotes, fields] = await Promise.all([
    loadCase(caseId),
    loadActiveQuotes(caseId),
    loadFields(caseId),
  ]);
  if (!caseRecord) throw new Error("案件不存在");
  const selected = quotes.find((q) => q.providerId === caseRecord.selectedQuoteProvider);
  const selectedStale =
    selected !== undefined &&
    (caseRecord.selectedQuoteVersion !== selected.version ||
      selected.profileVersion !== caseRecord.profileVersion);
  return {
    quotes,
    selectedProviderId: caseRecord.selectedQuoteProvider,
    selectedVersion: caseRecord.selectedQuoteVersion,
    selectedStale,
    profileVersion: caseRecord.profileVersion,
    vehicleLocation: fieldValue(fields, "vehicleLocation") as RegionValue | null,
  };
}

export async function selectQuote(
  caseId: string,
  providerId: string,
): Promise<QuoteRecord> {
  return withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    if (caseRecord.handedOverAt) {
      throw new Error("车辆已交接，不能重选服务方；请通过更正任务处理。");
    }
    const result = await client.query(
      `SELECT * FROM quotes
       WHERE case_id = $1 AND provider_id = $2 AND active = true
       ORDER BY version DESC LIMIT 1`,
      [caseId, providerId],
    );
    if (result.rows.length === 0) throw new Error("未找到该回收方的有效报价");
    const quote = mapRow(result.rows[0]);
    if (quote.netFen === null) {
      throw new Error("费用条件尚未确认（预计实收待确认），不能选择此报价。");
    }
    await client.query(
      `UPDATE cases SET selected_quote_provider = $2, selected_quote_version = $3,
         updated_at = now() WHERE id = $1`,
      [caseId, providerId, quote.version],
    );
    await appendEvent(client, caseId, {
      type: "quote_selected",
      payload: {
        providerId,
        version: quote.version,
        netFen: quote.netFen,
        label: "报价选择",
      },
      source: "user",
      demo: true,
    });
    return quote;
  }).then(async (quote) => {
    await syncTasks(caseId);
    return quote;
  });
}