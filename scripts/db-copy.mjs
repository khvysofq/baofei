// 把现有 Postgres 的业务数据整表搬运到嵌入式 PGlite。
//
// 用法（先迁移 schema、再种子初始化）：
//   DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite node scripts/db-migrate.mjs
//   DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite node scripts/db-seed.mjs
//   node scripts/db-copy.mjs --data-dir .data/pglite
//
// 源库从 .env.local 的 DATABASE_URL 读取；目标库只写 pglite。
import { mkdirSync } from "node:fs";
import { connectPg } from "./db-connect.mjs";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const argIndex = process.argv.indexOf("--data-dir");
const dataDir =
  (argIndex > -1 ? process.argv[argIndex + 1] : process.env.PGLITE_DATA_DIR) ||
  ".data/pglite";

if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL，无法读取源库");
  process.exit(1);
}

// 父表在前，避免外键顺序问题。
const TABLES = [
  "scenario_templates",
  "document_samples",
  "quote_templates",
  "city_policy_config",
  "cases",
  "vehicles",
  "case_fields",
  "documents",
  "tasks",
  "quotes",
  "appointments",
  "evidence",
  "subsidy_contexts",
  "events",
  "pricing_configs",
  "vin_lookups",
  "visit_events",
  "vin_search_events",
];

const SEQUENCES = {
  city_policy_config: "city_policy_config_id_seq",
  events: "events_id_seq",
  vin_lookups: "vin_lookups_id_seq",
  visit_events: "visit_events_id_seq",
  vin_search_events: "vin_search_events_id_seq",
};

function normalize(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType === "json" || dataType === "jsonb") return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

const source = await connectPg(process.env.DATABASE_URL);
const { PGlite } = await import("@electric-sql/pglite");
mkdirSync(dataDir, { recursive: true });
const target = new PGlite(dataDir);
await target.waitReady;

console.log(`源：Postgres  目标：PGlite ${dataDir}`);

try {
  await target.exec("BEGIN");
  await target.exec(`
    TRUNCATE TABLE
      events, evidence, appointments, quotes, tasks, documents,
      vehicles, case_fields, cases, subsidy_contexts,
      scenario_templates, document_samples, quote_templates, city_policy_config,
      pricing_configs, vin_lookups, visit_events, vin_search_events
    RESTART IDENTITY CASCADE
  `);

  for (const table of TABLES) {
    const { rows } = await source.query(`SELECT * FROM ${table} ORDER BY 1`);
    if (rows.length === 0) {
      console.log(`${table}: 0`);
      continue;
    }
    const columns = Object.keys(rows[0]);
    const typeResult = await source.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const types = new Map(typeResult.rows.map((r) => [r.column_name, r.data_type]));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
    for (const row of rows) {
      await target.query(
        sql,
        columns.map((c) => normalize(row[c], types.get(c))),
      );
    }
    console.log(`${table}: ${rows.length}`);
  }

  for (const [table, sequence] of Object.entries(SEQUENCES)) {
    const { rows } = await target.query(
      `SELECT COALESCE(MAX(id), 0)::int AS max_id FROM ${table}`,
    );
    const maxId = Number(rows[0]?.max_id ?? 0);
    await target.query("SELECT setval($1, $2, true)", [
      sequence,
      Math.max(1, maxId),
    ]);
  }

  await target.exec("COMMIT");
  console.log("数据搬运完成");
} catch (err) {
  await target.exec("ROLLBACK").catch(() => undefined);
  console.error("搬运失败：", err.message);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.close();
}