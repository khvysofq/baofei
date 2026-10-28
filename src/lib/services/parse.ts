import { createHash } from "node:crypto";
import type { CoreFieldName, FieldSource, FieldValue, ParseResult } from "@/lib/types";
import { parseIntake } from "@/lib/rules/intake";
import { cacheGet, cacheSet, parseCacheKey } from "@/lib/cache";
import { loadFields } from "@/lib/services/store";

export type KnownFields = Partial<
  Record<CoreFieldName, { value: FieldValue; confirmed: boolean; source?: FieldSource }>
>;

export async function knownFieldsForCase(caseId: string): Promise<KnownFields> {
  const fields = await loadFields(caseId);
  const known: KnownFields = {};
  for (const f of fields) {
    if (!f.confirmed) continue;
    if (
      f.field === "vehicleLocation" ||
      f.field === "registrationLocation" ||
      f.field === "ownerRelation" ||
      f.field === "drivable" ||
      f.field === "intent" ||
      f.field === "documentsStatus"
    ) {
      known[f.field] = {
        value: f.value,
        confirmed: f.confirmed,
        source: f.source,
      };
    }
  }
  return known;
}

export async function parseIntakeCached(
  text: string,
  knownFields?: KnownFields,
): Promise<ParseResult> {
  const payload = JSON.stringify({ text: (text ?? "").slice(0, 500), knownFields: knownFields ?? null });
  const hash = createHash("sha256").update(payload).digest("hex");
  const key = parseCacheKey(hash);

  const cached = await cacheGet(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Omit<ParseResult, "source">;
      return { ...parsed, source: "cache" };
    } catch {
      // 缓存损坏则重新解析
    }
  }

  const parsed = parseIntake(text, knownFields);
  const result: ParseResult = { ...parsed, source: "rule" };
  await cacheSet(key, JSON.stringify(parsed), 10 * 60);
  return result;
}