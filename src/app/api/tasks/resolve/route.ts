import { fail, ok, readJson, requireString } from "@/lib/api";
import { resolveTask } from "@/lib/services/plan";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const kind = requireString(body, "kind");
    const note = requireString(body, "note");
    const task = await resolveTask(caseId, kind, note);
    return ok(task);
  } catch (err) {
    return fail(err, 400);
  }
}