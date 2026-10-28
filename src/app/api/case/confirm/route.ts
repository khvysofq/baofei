import { fail, ok, readJson, requireString } from "@/lib/api";
import { confirmFields, getCaseSnapshot } from "@/lib/services/cases";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    await confirmFields(caseId);
    const snapshot = await getCaseSnapshot(caseId);
    return ok(snapshot);
  } catch (err) {
    return fail(err, 400);
  }
}