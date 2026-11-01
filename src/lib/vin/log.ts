import { query } from "../db";

/**
 * VIN 查询调用日志：用于统计各渠道的命中率、延迟与花费。
 * 这是运营数据，不是业务数据——写失败绝不影响查询。
 */

export type VinLookupLogStatus = "hit" | "cached" | "miss" | "error";

export type VinLookupLogEntry = {
  vin: string;
  providerId: string;
  status: VinLookupLogStatus;
  errorCode?: string | null;
  latencyMs: number;
  costFen: number;
  cached: boolean;
  reportNo?: string | null;
  raw?: unknown;
};

const LOG_TIMEOUT_MS = 800;

export async function recordVinLookup(entry: VinLookupLogEntry): Promise<void> {
  const keepRaw = process.env.VIN_DEBUG_RAW === "1";
  const payload = keepRaw && entry.raw !== undefined ? JSON.stringify(entry.raw) : null;

  const write = query(
    `INSERT INTO vin_lookups
       (vin, provider, status, error_code, latency_ms, cost_fen, cached, report_no, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      entry.vin,
      entry.providerId,
      entry.status,
      entry.errorCode ?? null,
      Math.max(0, Math.round(entry.latencyMs)),
      entry.costFen,
      entry.cached,
      entry.reportNo ?? null,
      payload,
    ],
  ).catch(() => {
    // 统计失败不影响主流程
  });

  await Promise.race([
    write,
    new Promise<void>((resolve) => setTimeout(resolve, LOG_TIMEOUT_MS)),
  ]);
}