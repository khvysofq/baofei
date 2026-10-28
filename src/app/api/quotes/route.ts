import { fail, ok } from "@/lib/api";
import { listQuotes } from "@/lib/services/quotes";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId");
  if (!caseId) return fail(new Error("缺少 caseId"), 400);
  try {
    return ok(await listQuotes(caseId));
  } catch (err) {
    return fail(err, 400);
  }
}