import { fail, ok, readJson, requireString } from "@/lib/api";
import type { DocumentType } from "@/lib/types";
import { selectSample } from "@/lib/services/documents";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const type = requireString(body, "type") as DocumentType;
    const sampleId = requireString(body, "sampleId");
    await selectSample(caseId, type, sampleId);
    return ok({ selected: true });
  } catch (err) {
    return fail(err, 400);
  }
}