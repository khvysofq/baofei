import { randomUUID } from "node:crypto";
import type { EvidenceStatus, EvidenceType } from "@/lib/types";
import { withTransaction } from "@/lib/db";
import { appendEvent } from "@/lib/services/events";
import { syncTasks } from "@/lib/services/plan";
import { query } from "@/lib/db";

export class CrossCaseEvidenceError extends Error {
  constructor(message = "凭证的车辆与案件不匹配，已拒绝关联。") {
    super(message);
    this.name = "CrossCaseEvidenceError";
  }
}

/**
 * 凭证必须绑定 caseId + vehicleId，且车辆必须属于该案件。
 * 跨案引用一律拒绝，并给出原因。
 */
export async function attachEvidence(input: {
  caseId: string;
  vehicleId: string;
  type: EvidenceType;
  status?: EvidenceStatus;
  description?: string;
  source?: string;
}): Promise<{ id: string }> {
  const result = await withTransaction(async (client) => {
    const caseRow = await client.query("SELECT id FROM cases WHERE id = $1", [input.caseId]);
    if (caseRow.rows.length === 0) throw new CrossCaseEvidenceError("案件不存在，拒绝关联凭证。");
    const vehicle = await client.query(
      "SELECT id, case_id FROM vehicles WHERE id = $1",
      [input.vehicleId],
    );
    if (vehicle.rows.length === 0) {
      throw new CrossCaseEvidenceError("车辆不存在，拒绝关联凭证。");
    }
    if (String(vehicle.rows[0].case_id) !== input.caseId) {
      throw new CrossCaseEvidenceError("凭证的车辆属于另一案件，跨案引用已拒绝。");
    }
    const existing = await client.query(
      "SELECT id FROM evidence WHERE case_id = $1 AND vehicle_id = $2 AND type = $3",
      [input.caseId, input.vehicleId, input.type],
    );
    if (existing.rows.length > 0) {
      throw new CrossCaseEvidenceError("该案件与车辆已存在同类型凭证，不能静默覆盖。");
    }
    const id = randomUUID();
    await client.query(
      `INSERT INTO evidence
        (id, case_id, vehicle_id, type, source, demo, event_time, status, description)
       VALUES ($1,$2,$3,$4,$5,true,now(),$6,$7)`,
      [
        id,
        input.caseId,
        input.vehicleId,
        input.type,
        input.source ?? "user",
        input.status ?? "provided",
        input.description ?? "演示凭证",
      ],
    );
    await appendEvent(client, input.caseId, {
      type: "evidence_attached",
      payload: { evidenceId: id, type: input.type, vehicleId: input.vehicleId, demo: true },
      source: "user",
      demo: true,
    });
    return id;
  });
  await syncTasks(input.caseId);
  return { id: result };
}

export async function listCaseEvidence(caseId: string) {
  return query(
    `SELECT id, case_id, vehicle_id, type, source, demo, event_time, status, description
     FROM evidence WHERE case_id = $1 ORDER BY created_at`,
    [caseId],
  );
}