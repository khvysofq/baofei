import { fail, ok, readJson, requireString } from "@/lib/api";
import { cancelAppointment } from "@/lib/services/appointments";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const reason = typeof body.reason === "string" ? body.reason : undefined;
    const appointment = await cancelAppointment(caseId, reason);
    return ok(appointment);
  } catch (err) {
    return fail(err, 400);
  }
}