// 按驱动连接数据库：pg（DATABASE_URL）或 pglite（PGLITE_DATA_DIR）。
// 供迁移/种子/搬运脚本共用。
import { mkdirSync } from "node:fs";
import pg from "pg";
import { loadEnv } from "./load-env.mjs";

export function dbMode() {
  const explicit = (process.env.DB_DRIVER || "").trim().toLowerCase();
  if (explicit === "pg" || explicit === "pglite") return explicit;
  return process.env.DATABASE_URL ? "pg" : "pglite";
}

export function pgliteDir() {
  loadEnv();
  return process.env.PGLITE_DATA_DIR?.trim() || ".data/pglite";
}

export async function connectDb() {
  loadEnv();
  const mode = dbMode();

  if (mode === "pg") {
    if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    return {
      driver: "pg",
      query: (sql, params = []) => client.query(sql, params),
      exec: (sql) => client.query(sql),
      close: () => client.end(),
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = pgliteDir();
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    driver: "pglite",
    query: (sql, params = []) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}

export async function connectPg(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client;
}