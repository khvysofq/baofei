// 重建 demo-sc-v1.1 种子：先清空业务与配置表，再写入固定数据。
// 可重复执行，执行后结果完全一致。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnv, rootDir } from "./load-env.mjs";

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL（请检查 .env.local）");
  process.exit(1);
}

const seed = JSON.parse(readFileSync(join(rootDir, "db", "seed-data.json"), "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  await client.query(`
    TRUNCATE TABLE
      events, evidence, appointments, quotes, tasks, documents,
      vehicles, case_fields, cases, subsidy_contexts,
      scenario_templates, document_samples, quote_templates, city_policy_config
    RESTART IDENTITY CASCADE
  `);

  for (const s of seed.scenarios) {
    await client.query(
      `INSERT INTO scenario_templates (id, version, name, intake_text, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [s.id, seed.version, s.name, s.intakeText, JSON.stringify(s.payload)],
    );
  }

  for (const s of seed.samples) {
    await client.query(
      `INSERT INTO document_samples
         (id, label, doc_type, quality, fields, original_fields, issues, asset_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        s.id,
        s.label,
        s.docType,
        s.quality,
        JSON.stringify(s.fields),
        JSON.stringify(s.originalFields),
        JSON.stringify(s.issues),
        s.assetKey,
      ],
    );
  }

  for (const q of seed.quoteTemplates) {
    await client.query(
      `INSERT INTO quote_templates
         (provider_id, version, name, gross_fen, tow_fen, service_fen, conditions, demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [
        q.providerId,
        q.version,
        q.name,
        q.grossFen,
        q.towFen,
        q.serviceFen,
        JSON.stringify(q.conditions),
      ],
    );
  }

  for (const p of seed.policies) {
    await client.query(
      `INSERT INTO city_policy_config
         (region, scope, source_ids, effective_from, effective_to, checked_at, version, status, notes, aliases)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        p.region,
        p.scope,
        JSON.stringify(p.sourceIds),
        p.effectiveFrom,
        p.effectiveTo,
        p.checkedAt,
        p.version,
        p.status,
        p.notes,
        JSON.stringify(p.aliases),
      ],
    );
  }

  await client.query("COMMIT");
  console.log(
    `种子完成：${seed.version} · ${seed.scenarios.length} 个场景 · ${seed.quoteTemplates.length} 份报价 · ${seed.samples.length} 份样例`,
  );
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}