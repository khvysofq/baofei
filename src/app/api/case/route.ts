import { fail, ok } from "@/lib/api";
import { getCaseSnapshot } from "@/lib/services/cases";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId");
  if (!caseId) return fail(new Error("缺少 caseId"), 400);
  try {
    const snapshot = await getCaseSnapshot(caseId);
    if (!snapshot) return fail(new Error("未找到案件，请先在 /start 描述车辆情况。"), 404);
    return ok(snapshot);
  } catch (err) {
    return fail(err, 400);
  }
}