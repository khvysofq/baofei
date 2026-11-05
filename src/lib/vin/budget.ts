/**
 * 第三方 VIN 渠道的每日调用预算。
 *
 * 目的：即使攻击者不断更换 VIN、绕过单 IP 限流，也不能在一天内把供应商额度刷光。
 * 只有「缓存未命中、真正要打渠道」时才预占一次；缓存命中完全不占用预算。
 *
 * 表 provider_usage 的 (day, provider_id) 是主键，靠一条原子 UPSERT 完成预占，
 * 并发请求不会超发。day 按北京时间计算，与运营统计口径一致。
 */

import { query } from "@/lib/db";

export type ProviderBudget = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
};

const DEFAULT_DAILY_LIMIT = 300;

export function dailyCallLimit(): number {
  const raw = Number(process.env.VIN_DAILY_CALL_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_DAILY_LIMIT;
  return Math.max(0, Math.floor(raw));
}

export async function reserveProviderCall(
  providerId: string,
): Promise<ProviderBudget> {
  const limit = dailyCallLimit();
  if (limit <= 0) {
    return { allowed: false, used: 0, limit, remaining: 0 };
  }

  const rows = await query<{ used: number }>(
    `INSERT INTO provider_usage (day, provider_id, used)
     VALUES ((now() AT TIME ZONE 'Asia/Shanghai')::date, $1, 1)
     ON CONFLICT (day, provider_id)
     DO UPDATE SET used = provider_usage.used + 1, updated_at = now()
     WHERE provider_usage.used < $2
     RETURNING used`,
    [providerId, limit],
  );

  if (rows.length > 0) {
    const used = Number(rows[0].used);
    return {
      allowed: true,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  const current = await query<{ used: number }>(
    `SELECT used FROM provider_usage
      WHERE day = (now() AT TIME ZONE 'Asia/Shanghai')::date
        AND provider_id = $1`,
    [providerId],
  );
  const used = Number(current[0]?.used ?? limit);
  return {
    allowed: false,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}