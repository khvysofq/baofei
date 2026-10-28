import { Redis } from "ioredis";

/** 所有键必须带 baofei: 前缀；这里统一拼接，避免散落在调用方。 */
const PREFIX = process.env.REDIS_KEY_PREFIX || "baofei:";

let client: Redis | null = null;

export function getRedis(): Redis {
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

/** 缓存不可用时返回 null，调用方必须能继续工作。 */
export async function cacheGet(name: string): Promise<string | null> {
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
  try {
    await getRedis().set(fullKey(name), value, "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDeleteByPrefix(namePrefix: string): Promise<void> {
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