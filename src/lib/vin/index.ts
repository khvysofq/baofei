import { cacheDelete, cacheGet, cacheSet } from "../cache";
import { recordVinLookup } from "./log";
import { validateVin } from "./normalize";
import { jisuepcProvider } from "./providers/jisuepc";
import {
  VinQueryError,
  type VinAttempt,
  type VinLookupOutcome,
  type VinProvider,
  type VinVehicleSpec,
} from "./types";

/**
 * VIN 查询总入口：渠道选择 → 缓存 → 重试 → 降级。
 *
 * 新增渠道只需两步：
 * 1. 在 `src/lib/vin/providers/` 下实现 `VinProvider`；
 * 2. 加进下面的 PROVIDERS，或在 VIN_PROVIDER_ORDER 里按优先级列出。
 *
 * 业务代码只调用 `queryVin()`，不要直接 import 具体渠道。
 */

const PROVIDERS: VinProvider[] = [jisuepcProvider];

const CACHE_VERSION = "v1";
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_MISS_TTL_SECONDS = 10 * 60;
const RETRY_BACKOFF_MS = 250;

const TRANSIENT_CODES = new Set([
  "TIMEOUT",
  "NETWORK",
  "UPSTREAM_ERROR",
  "RATE_LIMITED",
  "BAD_RESPONSE",
]);

/** 供未来渠道在模块加载时登记；重复 id 直接忽略。 */
export function registerVinProvider(provider: VinProvider): void {
  if (PROVIDERS.some((item) => item.id === provider.id)) return;
  PROVIDERS.push(provider);
}

export function listVinProviders(): {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
}[] {
  const order = providerOrder();
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
    enabled: order.includes(provider.id),
  }));
}

function providerOrder(): string[] {
  const raw = process.env.VIN_PROVIDER_ORDER?.trim();
  const ids = (raw ? raw.split(",") : PROVIDERS.map((item) => item.id))
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

function configuredProviders(): VinProvider[] {
  const order = providerOrder();
  return order
    .map((id) => PROVIDERS.find((provider) => provider.id === id))
    .filter((provider): provider is VinProvider => Boolean(provider && provider.isConfigured()));
}

function successKey(providerId: string, vin: string): string {
  return `vin:${CACHE_VERSION}:spec:${providerId}:${vin}`;
}

function missKey(vin: string): string {
  return `vin:${CACHE_VERSION}:miss:${vin}`;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function toVinError(caught: unknown, provider: VinProvider, latencyMs: number): VinQueryError {
  if (caught instanceof VinQueryError) {
    if (caught.latencyMs > 0) return caught;
    return new VinQueryError({
      code: caught.code,
      message: caught.message,
      providerId: caught.providerId || provider.id,
      providerLabel: caught.providerLabel || provider.label,
      retryable: caught.retryable,
      upstreamCode: caught.upstreamCode,
      latencyMs,
    });
  }
  return new VinQueryError({
    code: "UPSTREAM_ERROR",
    message: caught instanceof Error ? caught.message : "渠道调用失败",
    providerId: provider.id,
    providerLabel: provider.label,
    retryable: true,
    latencyMs,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type VinLookupOptions = {
  /** 单次渠道调用超时，默认 6000ms */
  timeoutMs?: number;
  /** 每个渠道的额外重试次数，默认 0（按次计费的接口别乱重试） */
  retries?: number;
  allowCache?: boolean;
  log?: boolean;
  signal?: AbortSignal;
  skipProviders?: string[];
};

/** 同一实例内的并发去重：相同 VIN 已在查时不再重复计费。 */
const IN_FLIGHT = new Map<string, Promise<VinLookupOutcome>>();

export async function queryVin(
  input: string,
  options: VinLookupOptions = {},
): Promise<VinLookupOutcome> {
  // 国标校验在调用任何渠道之前完成：不合法直接失败，不花一分钱。
  const validation = validateVin(input, {
    checkDigit: process.env.VIN_CHECK_DIGIT !== "off",
  });
  if (!validation.ok) {
    throw new VinQueryError({
      code: "INVALID_VIN",
      message: validation.message,
      providerId: "local",
      providerLabel: "本地校验",
      retryable: false,
    });
  }

  const vin = validation.vin;
  const key = `${vin}:${options.allowCache === false ? "nocache" : "cache"}`;
  const running = IN_FLIGHT.get(key);
  if (running) return running;

  const task = lookupVin(vin, options).finally(() => {
    IN_FLIGHT.delete(key);
  });
  IN_FLIGHT.set(key, task);
  return task;
}

async function lookupVin(
  vin: string,
  options: VinLookupOptions,
): Promise<VinLookupOutcome> {
  const providers = configuredProviders().filter(
    (provider) => !options.skipProviders?.includes(provider.id),
  );
  if (providers.length === 0) {
    throw new VinQueryError({
      code: "NOT_CONFIGURED",
      message: "未配置可用的 VIN 查询渠道。",
      providerId: "none",
      providerLabel: "未配置",
      retryable: false,
    });
  }

  const useCache = options.allowCache !== false;
  const shouldLog = options.log !== false;
  const timeoutMs = options.timeoutMs ?? numberFromEnv("VIN_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const retries = Math.max(0, options.retries ?? 0);
  const cacheTtl = numberFromEnv("VIN_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS);
  const missTtl = numberFromEnv("VIN_MISS_TTL_SECONDS", DEFAULT_MISS_TTL_SECONDS);
  const attempts: VinAttempt[] = [];

  if (useCache && (await cacheGet(missKey(vin)))) {
    throw new VinQueryError({
      code: "NOT_FOUND",
      message: "近期已查询过该 VIN，渠道未返回车型信息（10 分钟内不重复计费）。",
      providerId: providers[0].id,
      providerLabel: providers[0].label,
      retryable: false,
    });
  }

  const errors: VinQueryError[] = [];

  for (const provider of providers) {
    if (useCache) {
      const cached = await cacheGet(successKey(provider.id, vin));
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as VinVehicleSpec;
          const spec: VinVehicleSpec = {
            ...parsed,
            providerId: provider.id,
            providerLabel: provider.label,
            cached: true,
            latencyMs: 0,
          };
          attempts.push({
            providerId: provider.id,
            providerLabel: provider.label,
            ok: true,
            code: null,
            latencyMs: 0,
            cached: true,
          });
          if (shouldLog) {
            void recordVinLookup({
              vin,
              providerId: provider.id,
              status: "cached",
              latencyMs: 0,
              costFen: 0,
              cached: true,
            });
          }
          return {
            spec,
            providerId: provider.id,
            cached: true,
            attempts,
            fromCache: true,
          };
        } catch {
          // 缓存内容损坏：忽略，继续走实时查询
        }
      }
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const startedAt = Date.now();

      try {
        const result = await provider.query(vin, {
          signal: controller.signal,
          timeoutMs,
        });
        const latencyMs = Date.now() - startedAt;
        const spec: VinVehicleSpec = {
          ...result.spec,
          providerId: provider.id,
          providerLabel: provider.label,
          latencyMs,
          cached: false,
        };

        attempts.push({
          providerId: provider.id,
          providerLabel: provider.label,
          ok: true,
          code: null,
          latencyMs,
          cached: false,
        });

        if (useCache) {
          await cacheSet(successKey(provider.id, vin), JSON.stringify(spec), cacheTtl);
          await cacheDelete(missKey(vin));
        }
        if (shouldLog) {
          void recordVinLookup({
            vin,
            providerId: provider.id,
            status: "hit",
            latencyMs,
            costFen: provider.costFenPerQuery ?? 0,
            cached: false,
            raw: result.raw,
          });
        }

        return { spec, providerId: provider.id, cached: false, attempts, fromCache: false };
      } catch (caught) {
        const error = toVinError(caught, provider, Date.now() - startedAt);
        attempts.push({
          providerId: provider.id,
          providerLabel: provider.label,
          ok: false,
          code: error.code,
          latencyMs: error.latencyMs,
          cached: false,
        });
        if (shouldLog) {
          void recordVinLookup({
            vin,
            providerId: provider.id,
            status: error.code === "NOT_FOUND" ? "miss" : "error",
            errorCode: error.code,
            latencyMs: error.latencyMs,
            costFen: error.code === "NOT_FOUND" ? (provider.costFenPerQuery ?? 0) : 0,
            cached: false,
          });
        }

        const canRetry =
          attempt < retries &&
          error.retryable &&
          TRANSIENT_CODES.has(error.code) &&
          !options.signal?.aborted;

        if (canRetry) {
          await delay(RETRY_BACKOFF_MS * (attempt + 1));
          continue;
        }

        errors.push(error);
        break;
      } finally {
        options.signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  if (errors.length > 0 && errors.every((error) => error.code === "NOT_FOUND")) {
    if (useCache) await cacheSet(missKey(vin), "1", missTtl);
    throw new VinQueryError({
      code: "NOT_FOUND",
      message: "各渠道均未查到该 VIN 对应的车型信息，请核对 VIN 后重试，或上传行驶证照片。",
      providerId: errors[0].providerId,
      providerLabel: errors.map((error) => error.providerLabel).join("、"),
      retryable: false,
      latencyMs: errors.reduce((sum, error) => sum + error.latencyMs, 0),
    });
  }

  if (errors.length === 1) throw errors[0];

  throw new VinQueryError({
    code: "UPSTREAM_ERROR",
    message: `VIN 查询渠道暂时不可用：${errors
      .map((error) => `${error.providerLabel}（${error.code}）`)
      .join("；")}`,
    providerId: errors[0]?.providerId ?? "none",
    providerLabel: errors.map((error) => error.providerLabel).join("、"),
    retryable: true,
    latencyMs: errors.reduce((sum, error) => sum + error.latencyMs, 0),
  });
}

/** 把查询错误翻译成用户能看懂的话 + 是否有必要换渠道/换输入方式。 */
export function explainVinError(error: unknown): {
  code: string;
  message: string;
  shouldFallbackToDemo: boolean;
} {
  if (!(error instanceof VinQueryError)) {
    return {
      code: "UNKNOWN",
      message: "VIN 查询失败，请稍后重试。",
      shouldFallbackToDemo: true,
    };
  }

  switch (error.code) {
    case "INVALID_VIN":
      return { code: error.code, message: error.message, shouldFallbackToDemo: false };
    case "NOT_FOUND":
      return { code: error.code, message: error.message, shouldFallbackToDemo: false };
    case "QUOTA_EXCEEDED":
      return {
        code: error.code,
        message: "VIN 查询次数已用尽，请联系管理员充值，或先上传行驶证照片。",
        shouldFallbackToDemo: true,
      };
    case "UNAUTHORIZED":
      return {
        code: error.code,
        message: "VIN 查询渠道的 APPKEY 无效或已过期，请检查配置。",
        shouldFallbackToDemo: true,
      };
    case "TIMEOUT":
      return {
        code: error.code,
        message: "VIN 查询超时，已按规则引擎给出推定结果。",
        shouldFallbackToDemo: true,
      };
    default:
      return {
        code: error.code,
        message: "VIN 查询渠道暂时不可用，已按规则引擎给出推定结果。",
        shouldFallbackToDemo: true,
      };
  }
}