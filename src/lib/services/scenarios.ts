import { query } from "@/lib/db";

export async function listScenarios() {
  const rows = await query(
    "SELECT id, version, name, intake_text, payload FROM scenario_templates ORDER BY id",
  );
  return rows.map((row) => ({
    id: String(row.id),
    version: String(row.version),
    name: String(row.name),
    intakeText: String(row.intake_text),
    payload: row.payload,
    label: "常见情况",
  }));
}