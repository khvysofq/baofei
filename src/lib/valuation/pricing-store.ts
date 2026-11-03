/**
 * 定价配置持久层（仅服务端使用）
 *
 * - 公开报价页读 active 配置；数据库不可用或配置损坏时回退到 DEFAULT_PRICING，页面不报错。
 * - 保存时在事务里锁表、停用旧版本、插入新版本，保证同一时刻只有一行 active。
 */

import { query, withTransaction } from "@/lib/db";
import {
  DEFAULT_PRICING,
  validatePricingConfig,
  type PricingConfig,
} from "@/lib/valuation/pricing";

export type ActivePricing = {
  config: PricingConfig;
  version: number;
  updatedAt: string | null;
  /** true 表示数据库不可用、配置无效或尚未发布，正在使用内置默认价目表。 */
  fallback: boolean;
  fallbackReason: string | null;
};

export type PricingHistoryItem = {
  version: number;
  active: boolean;
  createdAt: string;
};

export class PricingConfigError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join("；"));
    this.name = "PricingConfigError";
    this.errors = errors;
  }
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export async function getActivePricing(): Promise<ActivePricing> {
  let rows: { version: number; payload: unknown; created_at: unknown }[];
  try {
    rows = await query<{ version: number; payload: unknown; created_at: unknown }>(
      `SELECT version, payload, created_at
         FROM pricing_configs
        WHERE active = true
        ORDER BY version DESC
        LIMIT 1`,
    );
  } catch {
    return {
      config: DEFAULT_PRICING,
      version: 0,
      updatedAt: null,
      fallback: true,
      fallbackReason: "定价数据库暂不可用，使用内置价目表。",
    };
  }

  const row = rows[0];
  if (!row) {
    return {
      config: DEFAULT_PRICING,
      version: 0,
      updatedAt: null,
      fallback: true,
      fallbackReason: "尚未发布定价版本，使用内置价目表。",
    };
  }

  const validation = validatePricingConfig(row.payload);
  if (!validation.ok) {
    return {
      config: DEFAULT_PRICING,
      version: 0,
      updatedAt: toIso(row.created_at),
      fallback: true,
      fallbackReason: "已发布的定价配置无效，使用内置价目表。",
    };
  }

  return {
    config: validation.config,
    version: row.version,
    updatedAt: toIso(row.created_at),
    fallback: false,
    fallbackReason: null,
  };
}

export async function listPricingHistory(limit = 20): Promise<PricingHistoryItem[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const rows = await query<{ version: number; active: boolean; created_at: unknown }>(
    `SELECT version, active, created_at
       FROM pricing_configs
      ORDER BY version DESC
      LIMIT $1`,
    [safeLimit],
  );
  return rows.map((row) => ({
    version: row.version,
    active: row.active,
    createdAt: toIso(row.created_at) ?? "",
  }));
}

export async function savePricing(input: unknown): Promise<{
  version: number;
  config: PricingConfig;
  createdAt: string;
}> {
  const validation = validatePricingConfig(input);
  if (!validation.ok) {
    throw new PricingConfigError(validation.errors);
  }
  const config = validation.config;

  return withTransaction(async (client) => {
    await client.query("LOCK TABLE pricing_configs IN EXCLUSIVE MODE");

    const nextResult = await client.query<{ next_version: number }>(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM pricing_configs",
    );
    const version = Number(nextResult.rows[0]?.next_version ?? 1);

    await client.query("UPDATE pricing_configs SET active = false WHERE active = true");
    const inserted = await client.query<{ created_at: unknown }>(
      `INSERT INTO pricing_configs (version, payload, active)
       VALUES ($1, $2::jsonb, true)
       RETURNING created_at`,
      [version, JSON.stringify(config)],
    );

    return {
      version,
      config,
      createdAt: toIso(inserted.rows[0]?.created_at) ?? new Date().toISOString(),
    };
  });
}