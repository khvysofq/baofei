/**
 * 轻量进程内限流（固定窗口）。
 *
 * 只保护真正会花钱的 VIN 查询入口，限制按客户端 IP 计：
 *   - 每分钟：VIN_RATE_LIMIT_PER_MINUTE（默认 8）
 *   - 每小时：VIN_RATE_LIMIT_PER_HOUR（默认 40）
 *   - 每天：  VIN_RATE_LIMIT_PER_DAY（默认 120）
 *
 * 进程内计数在重启后会清零，这是有意的取舍：实现简单、对正常用户无感；
 * 真正防止供应商额度被刷穿的是数据库里的每日渠道预算（budget.ts）。
 *
 * 取 IP 时优先用 Nginx 写入的 X-Real-IP，其次取 X-Forwarded-For 的最后一项，
 * 避免客户端自带 XFF 伪造 IP。
 */

type Bucket = { count: number; resetAt: number };

export type RateLimitWindow = "minute" | "hour" | "day";

export type RateLimitResult = {
  allowed: boolean;
  window: RateLimitWindow;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

const buckets = new Map<string, Bucket>();
let checks = 0;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

function windows(): { name: RateLimitWindow; limit: number; windowMs: number }[] {
  return [
    {
      name: "minute",
      limit: envInt("VIN_RATE_LIMIT_PER_MINUTE", 8),
      windowMs: 60_000,
    },
    {
      name: "hour",
      limit: envInt("VIN_RATE_LIMIT_PER_HOUR", 40),
      windowMs: 60 * 60_000,
    },
    {
      name: "day",
      limit: envInt("VIN_RATE_LIMIT_PER_DAY", 120),
      windowMs: 24 * 60 * 60_000,
    },
  ];
}

function consume(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  return {
    allowed: bucket.count <= limit,
    window: "minute",
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function sweep(now: number): void {
  checks += 1;
  if (checks % 500 !== 0) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** 返回第一个被触发的窗口；全部通过则返回分钟窗口的剩余量。 */
export function checkVinRateLimit(
  clientIp: string,
  now = Date.now(),
): RateLimitResult {
  sweep(now);
  const results = windows().map((item) => ({
    ...consume(`${clientIp}:${item.name}`, item.limit, item.windowMs, now),
    window: item.name,
  }));
  const blocked = results.find((item) => !item.allowed);
  return blocked ?? results[0];
}

/** 取可信客户端 IP：Nginx 的 X-Real-IP 优先，其次 XFF 最后一项。 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
}