// 读取 .env.local（仅用于本地脚本；不打印、不修改任何值）
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return;
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(file);
    return;
  }
  // 老版本 Node 的降级读取
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const rootDir = root;