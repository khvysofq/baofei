import { query } from "../db";

/**
 * 运营统计写入。
 *
 * 统计失败绝不影响主流程：查询/评估照常返回，只丢一条统计记录。
 */

const WRITE_TIMEOUT_MS = 800;

export type VinSearchStatus = "ok" | "not_found" | "error";

export type VinSearchEntry = {
  vin: string;
  isDemo: boolean;
  status: VinSearchStatus;
  errorCode?: string | null;
  brandModel?: string | null;
  vehicleType?: string | null;
  provider?: string | null;
  pricingVersion?: number | null;
};

export async function recordVinSearch(entry: VinSearchEntry): Promise<void> {
  const write = query(
    `INSERT INTO vin_search_events
       (vin, is_demo, status, error_code, brand_model, vehicle_type, provider, pricing_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.vin,
      entry.isDemo,
      entry.status,
      entry.errorCode ?? null,
      entry.brandModel ?? null,
      entry.vehicleType ?? null,
      entry.provider ?? null,
      entry.pricingVersion ?? null,
    ],
  ).catch(() => {
    // 统计失败不影响评估
  });

  await Promise.race([
    write,
    new Promise<void>((resolve) => setTimeout(resolve, WRITE_TIMEOUT_MS)),
  ]);
}

export type VisitEntry = {
  visitorId: string;
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
};

export async function recordVisit(entry: VisitEntry): Promise<void> {
  const write = query(
    `INSERT INTO visit_events (visitor_id, path, referrer, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [
      entry.visitorId,
      entry.path,
      entry.referrer?.slice(0, 500) ?? null,
      entry.userAgent?.slice(0, 500) ?? null,
    ],
  ).catch(() => {
    // 统计失败不影响访问
  });

  await Promise.race([
    write,
    new Promise<void>((resolve) => setTimeout(resolve, WRITE_TIMEOUT_MS)),
  ]);
}