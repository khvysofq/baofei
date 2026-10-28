import { fail, ok, readJson } from "@/lib/api";
import { createCase, type CreateCaseInput } from "@/lib/services/cases";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const input: CreateCaseInput = {
      scenarioId: typeof body.scenarioId === "string" ? body.scenarioId : null,
      fields: (body.fields ?? {}) as CreateCaseInput["fields"],
    };
    const created = await createCase(input);
    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 400);
  }
}