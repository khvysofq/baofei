import { fail, ok, readJson, requireString } from "@/lib/api";
import type { DocumentType } from "@/lib/types";
import { resolveMismatch, type MismatchAction } from "@/lib/services/documents";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const type = requireString(body, "type") as DocumentType;
    const action = requireString(body, "action") as MismatchAction;
    if (!["adopt_original", "manual", "assist"].includes(action)) {
      throw new Error("未知核对方式");
    }
    const manualValue = typeof body.manualValue === "string" ? body.manualValue : undefined;
    const result = await resolveMismatch(caseId, type, action, manualValue);
    return ok(result);
  } catch (err) {
    return fail(err, 400);
  }
}