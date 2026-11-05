/**
 * 缓存层：Redis（Valkey）可选，默认在无 REDIS_URL 时使用进程内存。
 *
 * 缓存是可选加速层，任何失败都必须降级为「没有缓存」，不能影响业务。
 * 云上单机部署没有 Valkey，用内存实现即可；多实例部署再配 Redis。
 */

import { Redis } from "ioredis";

const PREFIX = process.env.REDIS_KEY_PREFIX || "baofei:";

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();
let ops = 0;

let client: Redis | null = null;

function useMemory(): boolean {
  const mode = process.env.CACHE_DRIVER?.trim().toLowerCase();
  if (mode === "memory") return true;
  if (mode === "redis") return false;
  return !process.env.REDIS_URL;
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

function memoryGet(name: string): string | null {
  const entry = memory.get(name);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(name);
    return null;
  }
  return entry.value;
}

function memorySet(name: string, value: string, ttlSeconds: number): void {
  memory.set(name, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  });
  sweepMemory();
}

/** 缓存不可用时返回 null，调用方必须能继续工作。 */
export async function cacheGet(name: string): Promise<string | null> {
  if (useMemory()) return memoryGet(fullKey(name));
  try {
    return await getRedis().get(fullKey(name));
  } catch {
    return null;
  }
}

export async function cacheSet(
  name: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  if (useMemory()) {
    memorySet(fullKey(name), value, ttlSeconds);
    return true;
  }
  try {
    await getRedis().set(fullKey(name), value, "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDelete(name: string): Promise<void> {
  if (useMemory()) {
    memory.delete(fullKey(name));
    return;
  }
  try {
    await getRedis().del(fullKey(name));
  } catch {
    // 缓存是可选加速层，删除失败不影响业务
  }
}

export async function cacheDeleteByPrefix(namePrefix: string): Promise<void> {
  if (useMemory()) {
    const prefix = fullKey(namePrefix);
    for (const key of [...memory.keys()]) {
      if (key.startsWith(prefix)) memory.delete(key);
    }
    return;
  }
  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${PREFIX}${namePrefix}*`,
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

export function parseCacheKey(hash: string): string {
  return `parse:${hash}`;
}

export function idemKey(key: string): string {
  return `idem:${key}`;
}