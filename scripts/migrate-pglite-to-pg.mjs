// 把 PGlite 数据目录里的数据搬到真实 Postgres。
//
// 用法：
//   DATABASE_URL=postgres://baofei:***@127.0.0.1:5432/baofei \
//     node scripts/migrate-pglite-to-pg.mjs --pglite /var/lib/baofei/pglite
//
// 前提：目标库已经跑过 scripts/db-migrate.mjs（表结构一致）。
// 只做数据搬运：按表读全量，参数化 INSERT，冲突跳过；最后把自增序列推到 max+1。
// 需要在事务里临时关掉外键触发器，所以 DATABASE_URL 必须是超级用户或表属主。

import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const dataDir = arg("pglite", "/var/lib/baofei/pglite");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const lite = new PGlite(dataDir);
const target = new pg.Client({ connectionString: url });
await target.connect();

const ident = (name) => `"${name.replace(/"/g, '""')}"`;

async function tables() {
  const { rows } = await lite.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
}

async function columns(table) {
  const { rows } = await lite.query(
    `SELECT column_name, udt_name, is_identity, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  return rows;
}

const skip = new Set(["schema_migrations"]); // 目标库自己维护

const list = await tables();
let total = 0;

await target.query("BEGIN");
await target.query("SET LOCAL session_replication_role = replica");

for (const table of list) {
  if (skip.has(table) || table.startsWith("pg_")) continue;

  const cols = await columns(table);
  if (!cols.length) continue;

  const { rows } = await lite.query(`SELECT * FROM ${ident(table)}`);
  if (!rows.length) {
    console.log(`  ${table}: 0 行`);
    continue;
  }

  const names = cols.map((c) => c.column_name);
  const placeholders = names.map((_, i) => `$${i + 1}`).join(", ");
  const hasIdentity = cols.some((c) => c.is_identity === "YES");
  const overriding = hasIdentity ? " OVERRIDING SYSTEM VALUE" : "";
  const sql = `INSERT INTO ${ident(table)} (${names.map(ident).join(", ")})${overriding} VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map((c) => {
      const v = row[c.column_name];
      if (v === undefined) return null;
      if (c.udt_name === "json" || c.udt_name === "jsonb") {
        // PGlite 返回的是解析后的 JS 值；字符串可能本身就是 JSON 文本（如 '{"a":1}'），
        // 也可能是一个 JSON 字符串字面量（如 "self"），要区别对待。
        if (typeof v === "string") {
          try {
            JSON.parse(v);
            return v;
          } catch {
            return JSON.stringify(v);
          }
        }
        return JSON.stringify(v);
      }
      return v;
    });
    const res = await target.query(sql, values);
    inserted += res.rowCount ?? 0;
  }
  total += inserted;
  console.log(`  ${table}: 读取 ${rows.length} 行，写入 ${inserted} 行`);
}

await target.query("SET LOCAL session_replication_role = origin");

// 自增序列跟到 max(id)+1，避免新数据主键冲突
for (const table of list) {
  if (skip.has(table) || table.startsWith("pg_")) continue;
  const cols = await columns(table);
  for (const col of cols) {
    const isSerial = typeof col.column_default === "string" && col.column_default.startsWith("nextval(");
    if (!isSerial && col.is_identity !== "YES") continue;
    const { rows } = await target.query(
      `SELECT setval(pg_get_serial_sequence($1, $2),
              COALESCE((SELECT MAX(${ident(col.column_name)}) FROM ${ident(table)}), 0) + 1,
              false)
         WHERE pg_get_serial_sequence($1, $2) IS NOT NULL`,
      [table, col.column_name],
    );
    if (rows.length) console.log(`  序列 ${table}.${col.column_name} 已对齐`);
  }
}

await target.query("COMMIT");

const check = await target.query(
  `SELECT (SELECT count(*) FROM pricing_configs) pc,
          (SELECT count(*) FROM visit_events) v,
          (SELECT count(*) FROM vin_search_events) s`,
);
console.log(`写入合计 ${total} 行；目标库校验：`, check.rows[0]);

await target.end();
await lite.close();