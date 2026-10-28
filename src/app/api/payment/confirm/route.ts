import { fail, ok, readJson, requireString } from "@/lib/api";
import { syncTasks } from "@/lib/services/plan";
import { confirmPayment } from "@/lib/services/demo";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    await confirmPayment(caseId);
    await syncTasks(caseId);
    return ok({ confirmed: true });
  } catch (err) {
    return fail(err, 400);
  }
}