import { ok } from "@/lib/api";
import { cacheDriver } from "@/lib/cache";
import { dbDriver, query } from "@/lib/db";
import { ensureAllSampleAssets, isLocalStorage } from "@/lib/storage";

export async function GET() {
  let database = false;
  let storage = false;
  try {
    await query("SELECT 1");
    database = true;
  } catch {
    database = false;
  }
  try {
    await ensureAllSampleAssets();
    storage = true;
  } catch {
    storage = false;
  }
  return ok({
    status: "ok",
    demo: true,
    scenarioVersion: "demo-sc-v1.1",
    database,
    dbDriver: dbDriver(),
    storage,
    storageDriver: isLocalStorage() ? "local" : "s3",
    cacheDriver: cacheDriver(),
  });
}