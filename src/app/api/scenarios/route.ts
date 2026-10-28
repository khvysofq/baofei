import { fail, ok } from "@/lib/api";
import { listScenarios } from "@/lib/services/scenarios";

export async function GET() {
  try {
    return ok(await listScenarios());
  } catch (err) {
    return fail(err, 500);
  }
}