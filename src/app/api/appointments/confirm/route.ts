import { fail, ok, readJson, requireString } from "@/lib/api";
import { confirmAppointment } from "@/lib/services/appointments";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const idempotencyKey = requireString(body, "idempotencyKey");
    const slotId = requireString(body, "slotId");
    const location = requireString(body, "location");
    const handoverPerson = requireString(body, "handoverPerson");
    const drivable =
      typeof body.drivable === "boolean" ? body.drivable : null;
    const appointment = await confirmAppointment({
      caseId,
      idempotencyKey,
      slotId,
      location,
      handoverPerson,
      drivable,
    });
    return ok(appointment);
  } catch (err) {
    return fail(err, 400);
  }
}