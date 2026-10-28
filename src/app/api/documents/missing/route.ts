import { fail, ok, readJson, requireString } from "@/lib/api";
import { markRegistrationMissing } from "@/lib/services/documents";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    await markRegistrationMissing(caseId);
    return ok({ marked: true });
  } catch (err) {
    return fail(err, 400);
  }
}