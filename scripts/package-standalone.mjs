// 组装单机部署目录：.deploy/baofei
// 运行：pnpm build && node scripts/package-standalone.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { rootDir } from "./load-env.mjs";

const out = join(rootDir, ".deploy", "baofei");
const standalone = join(rootDir, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("未找到 .next/standalone/server.js，请先执行 pnpm build");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(standalone, out, { recursive: true, verbatimSymlinks: true });
cpSync(join(rootDir, ".next", "static"), join(out, ".next", "static"), {
  recursive: true,
  verbatimSymlinks: true,
});
if (existsSync(join(rootDir, "public"))) {
  cpSync(join(rootDir, "public"), join(out, "public"), { recursive: true });
}
cpSync(join(rootDir, "db"), join(out, "db"), { recursive: true });

const scriptsOut = join(out, "scripts");
mkdirSync(scriptsOut, { recursive: true });
for (const file of [
  "db-migrate.mjs",
  "db-seed.mjs",
  "db-copy.mjs",
  "db-connect.mjs",
  "load-env.mjs",
]) {
  cpSync(join(rootDir, "scripts", file), join(scriptsOut, file));
}
cpSync(join(rootDir, "package.json"), join(out, "package.json"));

// pnpm 的 standalone 有时只复制 .pnpm 存储但不建顶层软链，补一个。
const pgliteLink = join(out, "node_modules", "@electric-sql", "pglite");
if (!existsSync(pgliteLink)) {
  const pnpmDir = join(out, "node_modules", ".pnpm");
  const match = existsSync(pnpmDir)
    ? readdirSync(pnpmDir).find((name) => name.startsWith("@electric-sql+pglite@"))
    : undefined;
  if (!match) {
    console.error("standalone 中缺少 @electric-sql/pglite，无法部署");
    process.exit(1);
  }
  mkdirSync(join(out, "node_modules", "@electric-sql"), { recursive: true });
  const target = join(pnpmDir, match, "node_modules", "@electric-sql", "pglite");
  symlinkSync(
    join("..", ".pnpm", match, "node_modules", "@electric-sql", "pglite"),
    pgliteLink,
  );
  if (!existsSync(target)) {
    console.error("PGlite 软链目标不存在：" + target);
    process.exit(1);
  }
}

function sizeOf(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) total += sizeOf(full);
    else if (stat.isFile()) total += stat.size;
  }
  return total;
}

const mb = (sizeOf(out) / 1024 / 1024).toFixed(1);
console.log(`部署目录：${out}（${mb} MB）`);
console.log("启动：PORT=10812 HOSTNAME=127.0.0.1 node server.js");