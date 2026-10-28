import { fail, ok, readJson, requireString } from "@/lib/api";
import { selectQuote } from "@/lib/services/quotes";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const providerId = requireString(body, "providerId");
    const quote = await selectQuote(caseId, providerId);
    return ok(quote);
  } catch (err) {
    return fail(err, 400);
  }
}