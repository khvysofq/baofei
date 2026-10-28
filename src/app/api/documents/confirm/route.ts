import { fail, ok, readJson, requireString } from "@/lib/api";
import type { DocumentType } from "@/lib/types";
import { confirmDocument } from "@/lib/services/documents";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const type = requireString(body, "type") as DocumentType;
    await confirmDocument(caseId, type);
    return ok({ confirmed: true });
  } catch (err) {
    return fail(err, 400);
  }
}