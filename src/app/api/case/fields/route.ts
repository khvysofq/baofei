import { fail, ok, readJson, requireString } from "@/lib/api";
import type { CoreFieldName, FieldValue } from "@/lib/types";
import { updateField } from "@/lib/services/cases";

const ALLOWED = new Set<CoreFieldName>([
  "vehicleLocation",
  "registrationLocation",
  "ownerRelation",
  "drivable",
  "intent",
  "documentsStatus",
]);

export async function PATCH(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const field = requireString(body, "field") as CoreFieldName;
    if (!ALLOWED.has(field)) throw new Error("不支持修改该字段");
    const value = (body.value ?? null) as FieldValue;
    await updateField(caseId, field, value);
    return ok({ updated: true });
  } catch (err) {
    return fail(err, 400);
  }
}