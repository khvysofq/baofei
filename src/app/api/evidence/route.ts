import { fail, ok, readJson, requireString } from "@/lib/api";
import type { EvidenceStatus, EvidenceType } from "@/lib/types";
import { attachEvidence, CrossCaseEvidenceError } from "@/lib/services/evidence";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const vehicleId = requireString(body, "vehicleId");
    const type = requireString(body, "type") as EvidenceType;
    const status = (typeof body.status === "string" ? body.status : "provided") as EvidenceStatus;
    const result = await attachEvidence({
      caseId,
      vehicleId,
      type,
      status,
      description: typeof body.description === "string" ? body.description : undefined,
    });
    return ok(result);
  } catch (err) {
    if (err instanceof CrossCaseEvidenceError) {
      return fail(err, 409);
    }
    return fail(err, 400);
  }
}