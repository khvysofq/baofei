/**
 * 缓存层：Redis（Valkey）/ 数据库 / 进程内存。
 *
 * 默认规则：
 *   CACHE_DRIVER=redis  → Redis
 *   CACHE_DRIVER=db     → 数据库表 cache_entries（跨重启保留）
 *   CACHE_DRIVER=memory → 进程内存（重启即丢）
 *   未设置：有 REDIS_URL 用 Redis，否则用数据库
 *
 * 云上单机没有 Valkey，必须用 db 才能保证 VIN 车型缓存跨重启保留 30 天。
 * 缓存是可选加速层，任何失败都降级为「没有缓存」，不能影响业务。
 */

import { Redis } from "ioredis";
import { query } from "./db";

const PREFIX = process.env.REDIS_KEY_PREFIX || "baofei:";

export type CacheDriver = "redis" | "db" | "memory";

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();
let ops = 0;
let dbWrites = 0;

let client: Redis | null = null;

export function cacheDriver(): CacheDriver {
  const mode = process.env.CACHE_DRIVER?.trim().toLowerCase();
  if (mode === "redis" || mode === "db" || mode === "memory") return mode;
  return process.env.REDIS_URL ? "redis" : "db";
}

function getRedis(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("缺少 REDIS_URL");
    client = new Redis(url, {
      lazyConnect: false,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 2 ? null : 200),
    });
    client.on("error", () => {
      // 缓存是可选加速层；错误由调用方降级处理，这里避免 unhandled error 噪声。
    });
  }
  return client;
}

function fullKey(name: string): string {
  return `${PREFIX}${name}`;
}

function sweepMemory(): void {
  ops += 1;
  if (ops % 200 !== 0) return;
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
}

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memory.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  });
  sweepMemory();
}

async function dbGet(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>(
    "SELECT value FROM cache_entries WHERE key = $1 AND expires_at > now()",
    [key],
  );
  return rows[0]?.value ?? null;
}

async function dbSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(1, ttlSeconds) * 1000).toISOString();
  await query(
    `INSERT INTO cache_entries (key, value, expires_at)
     VALUES ($1, $2, $3::timestamptz)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
    [key, value, expiresAt],
  );
  dbWrites += 1;
  if (dbWrites % 200 === 0) {
    // 低概率顺手清理过期行，避免表无限增长。
    void query("DELETE FROM cache_entries WHERE expires_at < now()").catch(
      () => undefined,
    );
  }
}

/** 缓存不可用时返回 null，调用方必须能继续工作。 */
export async function cacheGet(name: string): Promise<string | null> {
  const key = fullKey(name);
  const driver = cacheDriver();
  if (driver === "memory") return memoryGet(key);

  if (driver === "db") {
    try {
      return await dbGet(key);
    } catch {
      return memoryGet(key);
    }
  }

  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  name: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = fullKey(name);
  const driver = cacheDriver();
  if (driver === "memory") {
    memorySet(key, value, ttlSeconds);
    return true;
  }

  if (driver === "db") {
    try {
      await dbSet(key, value, ttlSeconds);
      return true;
    } catch {
      memorySet(key, value, ttlSeconds);
      return false;
    }
  }

  try {
    await getRedis().set(key, value, "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/** 命中后顺延 TTL：经常被查询的车辆不会在 30 天后突然重新计费。 */
export async function cacheTouch(name: string, ttlSeconds: number): Promise<void> {
  const key = fullKey(name);
  const driver = cacheDriver();
  if (driver === "memory") {
    const entry = memory.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      entry.expiresAt = Date.now() + Math.max(1, ttlSeconds) * 1000;
    }
    return;
  }

  if (driver === "db") {
    try {
      const expiresAt = new Date(
        Date.now() + Math.max(1, ttlSeconds) * 1000,
      ).toISOString();
      await query(
        "UPDATE cache_entries SET expires_at = $2::timestamptz WHERE key = $1 AND expires_at > now()",
        [key, expiresAt],
      );
    } catch {
      // 顺延失败不影响本次读取
    }
    return;
  }

  try {
    await getRedis().expire(key, Math.max(1, Math.floor(ttlSeconds)));
  } catch {
    // 顺延失败不影响本次读取
  }
}

export async function cacheDelete(name: string): Promise<void> {
  const key = fullKey(name);
  const driver = cacheDriver();
  if (driver === "memory") {
    memory.delete(key);
    return;
  }

  if (driver === "db") {
    try {
      await query("DELETE FROM cache_entries WHERE key = $1", [key]);
    } catch {
      // 缓存删除失败不影响业务
    }
    return;
  }

  try {
    await getRedis().del(key);
  } catch {
    // 缓存是可选加速层，删除失败不影响业务
  }
}

export async function cacheDeleteByPrefix(namePrefix: string): Promise<void> {
  const prefix = fullKey(namePrefix);
  const driver = cacheDriver();
  memoryDeleteByPrefix(prefix);

  if (driver === "db") {
    try {
      await query("DELETE FROM cache_entries WHERE key LIKE $1", [`${prefix}%`]);
    } catch {
      // 清理失败不回滚业务操作
    }
    return;
  }

  if (driver === "memory") return;

  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100,
      );
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // 清理失败不回滚业务操作
  }
}

function memoryDeleteByPrefix(prefix: string): void {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export function parseCacheKey(hash: string): string {
  return `parse:${hash}`;
}

export function idemKey(key: string): string {
  return `idem:${key}`;
}