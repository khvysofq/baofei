// 7 个页面 + /api/health 冒烟。若 10802 未启动，会临时拉起 next dev，检查后关掉。
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:10802";
const PORT = new URL(base).port || "10802";

const ROUTES = [
  ["/start", "演示模式"],
  ["/plan", "演示模式"],
  ["/documents", "演示模式"],
  ["/quotes", "演示模式"],
  ["/appointment", "演示模式"],
  ["/case", "演示模式"],
  ["/subsidy", "演示模式"],
];

const FORBIDDEN = [
  "Hydration failed",
  "Text content does not match server-rendered HTML",
  "Minified React error",
  "即将上线",
  "敬请期待",
  "官方已核验",
  "保证到账",
  "一定能领补贴",
];

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

let child = null;
let started = false;

async function ensureServer() {
  if (await probe(`${base}/api/health`)) return;
  started = true;
  console.log(`10802 未启动，临时拉起 next dev…`);
  child = spawn("pnpm", ["dev", "--port", PORT, "--hostname", "127.0.0.1"], {
    cwd: root,
    env: process.env,
    stdio: "ignore",
    detached: false,
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await probe(`${base}/api/health`)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("临时启动 dev server 超时（90s）");
}

async function stopServer() {
  if (!child || !started) return;
  child.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 800));
  if (!child.killed) child.kill("SIGKILL");
}

let failed = false;

try {
  await ensureServer();

  const healthRes = await fetch(`${base}/api/health`);
  const health = await healthRes.json();
  const healthOk =
    healthRes.status === 200 && health?.data?.status === "ok";
  console.log(
    `${healthOk ? "PASS" : "FAIL"}  /api/health  ${healthRes.status}  db=${health?.data?.database} s3=${health?.data?.storage}`,
  );
  if (!healthOk) failed = true;

  for (const [route, marker] of ROUTES) {
    const res = await fetch(`${base}${route}`, {
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const statusOk = res.status === 200;
    const markerOk = html.includes(marker);
    const forbidden = FORBIDDEN.filter((word) => html.includes(word));
    const ok = statusOk && markerOk && forbidden.length === 0;
    if (!ok) failed = true;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${route}  ${res.status}  marker=${markerOk}  forbidden=${forbidden.join(",") || "none"}`,
    );
  }

  console.log(
    started
      ? "冒烟完成（临时 dev server 已关闭）"
      : "冒烟完成（使用已运行的 10802 服务）",
  );
} catch (err) {
  failed = true;
  console.error("冒烟失败：", err instanceof Error ? err.message : err);
} finally {
  await stopServer();
}

process.exit(failed ? 1 : 0);