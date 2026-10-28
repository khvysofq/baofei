import { fail, ok, readJson, requireString } from "@/lib/api";
import { buildHelpCard, HELP_KINDS, recordHelpCard, type HelpKind } from "@/lib/services/help";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const kind = requireString(body, "kind") as HelpKind;
    if (!HELP_KINDS.some((k) => k.id === kind)) throw new Error("未知协助类型");
    const record = body.record === true;
    const card = record
      ? await recordHelpCard(caseId, kind)
      : await buildHelpCard(caseId, kind);
    return ok(card);
  } catch (err) {
    return fail(err, 400);
  }
}