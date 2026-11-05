// 幂等迁移：按文件名顺序执行 db/migrations/*.sql，已执行版本记录在 schema_migrations。
// 支持 pg 与 pglite 两种驱动，见 scripts/db-connect.mjs。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connectDb } from "./db-connect.mjs";
import { rootDir } from "./load-env.mjs";

const dir = join(rootDir, "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const db = await connectDb();
console.log(`驱动：${db.driver}`);

try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const { rows } = await db.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [file],
    );
    if (rows.length > 0) {
      console.log(`skip  ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    await db.exec("BEGIN");
    try {
      await db.exec(sql);
      await db.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
      await db.exec("COMMIT");
      console.log(`apply ${file}`);
    } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
    }
  }
  console.log("迁移完成");
} finally {
  await db.close();
}