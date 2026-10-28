// 幂等迁移：按文件名顺序执行 db/migrations/*.sql，已执行版本记录在 schema_migrations。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnv, rootDir } from "./load-env.mjs";

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL（请检查 .env.local）");
  process.exit(1);
}

const dir = join(rootDir, "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [file],
    );
    if (rows.length > 0) {
      console.log(`skip  ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`apply ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  console.log("迁移完成");
} finally {
  await client.end();
}