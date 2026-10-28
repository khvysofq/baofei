import { existsSync } from "node:fs";

const file = new URL("../.env.local", import.meta.url);
if (existsSync(file)) {
  process.loadEnvFile(file);
}
(process.env as Record<string, string | undefined>).NODE_ENV =
  process.env.NODE_ENV || "test";