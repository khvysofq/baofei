import { fail, ok, readJson, requireString } from "@/lib/api";
import {
  getAppointmentView,
  rescheduleAppointment,
} from "@/lib/services/appointments";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId");
  if (!caseId) return fail(new Error("缺少 caseId"), 400);
  try {
    return ok(await getAppointmentView(caseId));
  } catch (err) {
    return fail(err, 400);
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const slotId = requireString(body, "slotId");
    const appointment = await rescheduleAppointment(caseId, {
      slotId,
      location: typeof body.location === "string" ? body.location : undefined,
      handoverPerson:
        typeof body.handoverPerson === "string" ? body.handoverPerson : undefined,
      drivable: typeof body.drivable === "boolean" ? body.drivable : undefined,
    });
    return ok(appointment);
  } catch (err) {
    return fail(err, 400);
  }
}