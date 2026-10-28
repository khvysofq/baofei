import { fail, ok, readJson } from "@/lib/api";
import { knownFieldsForCase, parseIntakeCached } from "@/lib/services/parse";

export async function POST(request: Request) {
  const body = await readJson(request);
  const text = typeof body.text === "string" ? body.text : "";
  const caseId = typeof body.caseId === "string" ? body.caseId : undefined;
  try {
    const known = caseId ? await knownFieldsForCase(caseId) : undefined;
    const parsed = await parseIntakeCached(text, known);
    return ok(parsed);
  } catch (err) {
    return fail(err, 400);
  }
}