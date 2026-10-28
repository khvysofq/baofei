import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import type { EventRecord, EventSource } from "@/lib/types";

export type EventInput = {
  type: string;
  payload?: Record<string, unknown>;
  source?: EventSource;
  demo?: boolean;
};

/**
 * 所有状态变化的唯一入口。events 表 append-only。
 * 调用方必须已在事务中锁定案件行（appendEvent 内部会锁）。
 */
export async function appendEvent(
  client: PoolClient,
  caseId: string,
  input: EventInput,
): Promise<EventRecord> {
  const locked = await client.query(
    "SELECT id FROM cases WHERE id = $1 FOR UPDATE",
    [caseId],
  );
  if (locked.rows.length === 0) throw new Error("案件不存在");

  const seqRow = await client.query(
    "SELECT COALESCE(MAX(sequence), 0) + 1 AS seq FROM events WHERE case_id = $1",
    [caseId],
  );
  const sequence = Number(seqRow.rows[0].seq);
  const source = input.source ?? "user";
  const demo = input.demo ?? true;

  const result = await client.query(
    `INSERT INTO events (case_id, sequence, type, payload, source, demo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, case_id, sequence, type, payload, source, demo, created_at`,
    [caseId, sequence, input.type, JSON.stringify(input.payload ?? {}), source, demo],
  );
  const row = result.rows[0];
  return {
    id: Number(row.id),
    caseId: String(row.case_id),
    sequence: Number(row.sequence),
    type: String(row.type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    source: String(row.source) as EventSource,
    demo: Boolean(row.demo),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function appendEventStandalone(
  caseId: string,
  input: EventInput,
): Promise<EventRecord> {
  return withTransaction((client) => appendEvent(client, caseId, input));
}

export async function listEvents(caseId: string): Promise<EventRecord[]> {
  const rows = await query(
    `SELECT id, case_id, sequence, type, payload, source, demo, created_at
     FROM events WHERE case_id = $1 ORDER BY sequence ASC`,
    [caseId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    caseId: String(row.case_id),
    sequence: Number(row.sequence),
    type: String(row.type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    source: String(row.source) as EventSource,
    demo: Boolean(row.demo),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function latestEventType(
  caseId: string,
  types: string[],
): Promise<EventRecord | null> {
  if (types.length === 0) return null;
  const rows = await query(
    `SELECT id, case_id, sequence, type, payload, source, demo, created_at
     FROM events WHERE case_id = $1 AND type = ANY($2::text[])
     ORDER BY sequence DESC LIMIT 1`,
    [caseId, types],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    caseId: String(row.case_id),
    sequence: Number(row.sequence),
    type: String(row.type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    source: String(row.source) as EventSource,
    demo: Boolean(row.demo),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function eventExists(caseId: string, type: string): Promise<boolean> {
  const rows = await query(
    "SELECT 1 FROM events WHERE case_id = $1 AND type = $2 LIMIT 1",
    [caseId, type],
  );
  return rows.length > 0;
}