/**
 * 数据库访问层：支持两种驱动
 *
 * - `pg`：托管/独立 Postgres（本机开发、完整部署）
 * - `pglite`：嵌入式 Postgres（WASM），数据落在本地目录，无需数据库服务
 *
 * 选择规则：
 *   DB_DRIVER=pglite            → 强制嵌入模式
 *   DB_DRIVER=pg                → 强制 Postgres
 *   未设置时有 DATABASE_URL     → Postgres
 *   未设置且无 DATABASE_URL     → PGlite（PGLITE_DATA_DIR 默认 .data/pglite）
 *
 * PGlite 是单连接实现，所有查询与事务必须串行执行；这里用一个进程内队列
 * 保证不会出现「A 请求的 BEGIN/ROLLBACK 夹住 B 请求」的问题。
 */

import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import type { Pool as PgPool, PoolClient as PgPoolClient, QueryResultRow } from "pg";

export type DbRow = Record<string, unknown>;

export type DbQueryResult<T = DbRow> = {
  rows: T[];
  rowCount?: number | null;
};

export type DbClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<DbQueryResult<T>>;
};

type LiteResult = { rows: unknown[]; affectedRows?: number };
type LiteClient = {
  query(sql: string, params?: unknown[]): Promise<LiteResult>;
  close(): Promise<void>;
};

type Driver = "pg" | "pglite";

let driver: Driver | null = null;
let pgPool: PgPool | null = null;
let lite: LiteClient | null = null;
let liteReady: Promise<LiteClient> | null = null;

/** PGlite 单连接串行队列。 */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function resolveDriver(): Driver {
  if (driver) return driver;
  const explicit = process.env.DB_DRIVER?.trim().toLowerCase();
  if (explicit === "pglite" || explicit === "pg") {
    driver = explicit;
  } else {
    driver = process.env.DATABASE_URL ? "pg" : "pglite";
  }
  return driver;
}

export function dbDriver(): Driver {
  return resolveDriver();
}

export function pgliteDataDir(): string {
  return process.env.PGLITE_DATA_DIR?.trim() || ".data/pglite";
}

async function getLite(): Promise<LiteClient> {
  if (lite) return lite;
  if (!liteReady) {
    liteReady = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const dir = pgliteDataDir();
      mkdirSync(dir, { recursive: true });
      const instance = new PGlite(dir);
      await instance.waitReady;
      return instance as unknown as LiteClient;
    })();
  }
  lite = await liteReady;
  return lite;
}

export function getPool(): PgPool {
  if (resolveDriver() === "pglite") {
    throw new Error("当前为 PGlite 嵌入模式，没有 pg 连接池");
  }
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("缺少 DATABASE_URL");
    }
    pgPool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX || 10),
    });
  }
  return pgPool;
}

function wrapPgClient(client: PgPool | PgPoolClient): DbClient {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await client.query<T>(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    },
  };
}

function wrapLiteClient(client: LiteClient): DbClient {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.affectedRows ?? null };
    },
  };
}

/** 普通查询：Postgres 直接走池，PGlite 走串行队列。 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (resolveDriver() === "pglite") {
    return serial(async () => {
      const client = await getLite();
      const result = await client.query(sql, params);
      return result.rows as T[];
    });
  }
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function withTransaction<T>(
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  if (resolveDriver() === "pglite") {
    return serial(async () => {
      const client = await getLite();
      await client.query("BEGIN");
      try {
        const result = await fn(wrapLiteClient(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
    });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(wrapPgClient(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** 供服务层持有一个「可查询对象」；与具体驱动解耦。 */
export function getDbClient(): DbClient {
  if (resolveDriver() === "pglite") {
    return {
      async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
        const rows = await query<T>(sql, params);
        return { rows, rowCount: rows.length };
      },
    };
  }
  return wrapPgClient(getPool());
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}