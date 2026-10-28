import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  DocumentIssue,
  DocumentType,
  RegionValue,
} from "@/lib/types";
import { withTransaction } from "@/lib/db";
import { loadCase, loadDocuments, loadFields, fieldValue, requiredDocumentTypes } from "@/lib/services/store";
import { appendEvent } from "@/lib/services/events";
import { syncTasks } from "@/lib/services/plan";
import { isSampleId } from "@/lib/storage";

export const DOCUMENT_META: Record<DocumentType, { label: string; hint: string }> = {
  DRIVING_LICENSE: {
    label: "行驶证",
    hint: "核对号牌、车辆识别代号与使用性质。",
  },
  REGISTRATION_CERT: {
    label: "登记证（绿本）",
    hint: "核对登记日期、所有人与车辆识别代号。暂时找不到可先标记缺失。",
  },
  AUTHORIZATION: {
    label: "授权与代办核对",
    hint: "家人协助办理时，核对车主授权与代办材料；本版不采集真实授权书。",
  },
};

export type SampleChoice = {
  id: string;
  label: string;
};

export async function listSamples(): Promise<SampleChoice[]> {
  const { query } = await import("@/lib/db");
  const rows = await query(
    "SELECT id, label FROM document_samples ORDER BY label",
  );
  return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
}

export async function getDocumentsView(caseId: string) {
  const { buildSnapshot } = await import("@/lib/services/plan");
  const snapshot = await buildSnapshot(caseId);
  if (!snapshot) throw new Error("案件不存在");
  const fields = snapshot.fields;
  const ownerRelation = String(fieldValue(fields, "ownerRelation") ?? "unknown");
  const requiredTypes = requiredDocumentTypes(ownerRelation);
  const documents = requiredTypes.map((type) => {
    const existing = snapshot.documents.find((d) => d.type === type);
    return {
      type,
      label: DOCUMENT_META[type].label,
      hint: DOCUMENT_META[type].hint,
      sampleId: existing?.sampleId ?? null,
      quality: existing?.quality ?? null,
      issues: existing?.issues ?? [],
      fields: existing?.fields ?? null,
      originalFields: existing?.originalFields ?? null,
      confirmed: existing?.confirmed ?? false,
      verificationStatus: existing?.verificationStatus ?? "unverified",
      documentId: existing?.id ?? null,
    };
  });
  const samples = await listSamples();
  return {
    documents,
    samples,
    documentsStatus: String(fieldValue(fields, "documentsStatus") ?? "unknown"),
    missingTask: snapshot.tasks.find((t) => t.kind === "review_missing_document") ?? null,
    nextAction: snapshot.nextAction,
    materialsVersion: snapshot.case.materialsVersion,
    profileVersion: snapshot.case.profileVersion,
  };
}

async function bumpMaterials(client: PoolClient, caseId: string): Promise<number> {
  const result = await client.query(
    `UPDATE cases SET materials_version = materials_version + 1, updated_at = now()
     WHERE id = $1 RETURNING materials_version`,
    [caseId],
  );
  await client.query(
    `UPDATE appointments SET status = 'needs_reconfirmation', updated_at = now()
     WHERE case_id = $1 AND status = 'booked'`,
    [caseId],
  );
  return Number(result.rows[0].materials_version);
}

export async function selectSample(
  caseId: string,
  type: DocumentType,
  sampleId: string,
): Promise<void> {
  if (!DOCUMENT_META[type]) throw new Error("不支持的材料类型");
  if (!isSampleId(sampleId)) throw new Error("只能选择内置演示资料");
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    if (caseRecord.handedOverAt) {
      throw new Error("车辆已交接，材料变更请通过更正任务处理。");
    }
    const sample = await client.query("SELECT * FROM document_samples WHERE id = $1", [
      sampleId,
    ]);
    if (sample.rows.length === 0) throw new Error("演示样例不存在");
    const s = sample.rows[0];
    const vehicle = await client.query(
      "SELECT id FROM vehicles WHERE case_id = $1",
      [caseId],
    );
    if (vehicle.rows.length === 0) throw new Error("案件缺少车辆记录");

    const existing = await client.query(
      "SELECT id FROM documents WHERE case_id = $1 AND type = $2",
      [caseId, type],
    );
    const id = existing.rows.length ? String(existing.rows[0].id) : randomUUID();
    if (existing.rows.length) {
      await client.query(
        `UPDATE documents SET sample_id = $2, fields = $3, original_fields = $4,
           issues = $5, quality = $6, verification_status = 'unverified',
           confirmed = false, updated_at = now()
         WHERE id = $1`,
        [
          id,
          sampleId,
          JSON.stringify(s.fields),
          JSON.stringify(s.original_fields ?? {}),
          JSON.stringify(s.issues ?? []),
          s.quality,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO documents
          (id, case_id, vehicle_id, type, sample_id, fields, original_fields,
           issues, quality, verification_status, confirmed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unverified',false)`,
        [
          id,
          caseId,
          String(vehicle.rows[0].id),
          type,
          sampleId,
          JSON.stringify(s.fields),
          JSON.stringify(s.original_fields ?? {}),
          JSON.stringify(s.issues ?? []),
          s.quality,
        ],
      );
    }

    await bumpMaterials(client, caseId);
    await appendEvent(client, caseId, {
      type: "material_selected",
      payload: {
        documentType: type,
        sampleId,
        label: String(s.label),
        quality: String(s.quality),
        issueShown: (s.issues as unknown[]).length > 0,
      },
      source: "user",
      demo: true,
    });
    if ((s.issues as unknown[]).length > 0) {
      await appendEvent(client, caseId, {
        type: "material_issue_shown",
        payload: {
          documentType: type,
          sampleId,
          issues: s.issues,
        },
        source: "rule",
        demo: true,
      });
    }
  });
  await syncTasks(caseId);
}

export async function confirmDocument(caseId: string, type: DocumentType): Promise<void> {
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    const doc = await client.query(
      "SELECT * FROM documents WHERE case_id = $1 AND type = $2",
      [caseId, type],
    );
    if (doc.rows.length === 0 || !doc.rows[0].sample_id) {
      throw new Error("请先选择一份演示资料");
    }
    const row = doc.rows[0];
    const issues = (row.issues ?? []) as DocumentIssue[];
    if (issues.some((i) => i.kind === "mismatch")) {
      throw new Error("存在字段不一致，请先采用原件值或手动修改后再确认。");
    }
    await client.query(
      `UPDATE documents SET confirmed = true, verification_status = 'confirmed',
         updated_at = now() WHERE case_id = $1 AND type = $2`,
      [caseId, type],
    );
    await bumpMaterials(client, caseId);
    await appendEvent(client, caseId, {
      type: "material_confirmed",
      payload: { documentType: type, quality: String(row.quality) },
      source: "user",
      demo: true,
    });
  });
  await syncTasks(caseId);
}

export type MismatchAction = "adopt_original" | "manual" | "assist";

export async function resolveMismatch(
  caseId: string,
  type: DocumentType,
  action: MismatchAction,
  manualValue?: string,
): Promise<{ assisted: boolean }> {
  if (action === "assist") {
    await withTransaction(async (client) => {
      await appendEvent(client, caseId, {
        type: "help_requested",
        payload: {
          topic: "material_mismatch",
          documentType: type,
          note: "字段不一致，需要演示协助确认；不视为已确认。",
        },
        source: "user",
        demo: true,
      });
    });
    await syncTasks(caseId);
    return { assisted: true };
  }

  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    const doc = await client.query(
      "SELECT * FROM documents WHERE case_id = $1 AND type = $2",
      [caseId, type],
    );
    if (doc.rows.length === 0) throw new Error("材料不存在");
    const row = doc.rows[0];
    const fields = { ...((row.fields ?? {}) as Record<string, string>) };
    const original = (row.original_fields ?? {}) as Record<string, string>;
    const issues = (row.issues ?? []) as DocumentIssue[];
    const mismatches = issues.filter((i) => i.kind === "mismatch");
    if (mismatches.length === 0) throw new Error("该材料没有字段不一致");

    for (const issue of mismatches) {
      const value =
        action === "adopt_original" ? original[issue.field] : (manualValue ?? "").trim();
      if (!value) throw new Error("请填写修正后的字段值");
      fields[issue.field] = value;
    }
    const remaining = issues.filter((i) => i.kind !== "mismatch");
    await client.query(
      `UPDATE documents SET fields = $2, issues = $3, verification_status = 'corrected',
         updated_at = now() WHERE id = $1`,
      [row.id, JSON.stringify(fields), JSON.stringify(remaining)],
    );
    await bumpMaterials(client, caseId);
    await appendEvent(client, caseId, {
      type: "material_field_corrected",
      payload: {
        documentType: type,
        action,
        fields: mismatches.map((i) => (i.kind === "mismatch" ? i.field : "")),
      },
      source: "user",
      demo: true,
    });
  });
  await syncTasks(caseId);
  return { assisted: false };
}

export async function markRegistrationMissing(caseId: string): Promise<void> {
  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    await client.query(
      `INSERT INTO case_fields (case_id, field, value, source, confirmed, confidence, updated_at)
       VALUES ($1,'documentsStatus','"missing_registration"'::jsonb,'user',true,1,now())
       ON CONFLICT (case_id, field)
       DO UPDATE SET value = '"missing_registration"'::jsonb, source = 'user',
         confirmed = true, confidence = 1, updated_at = now()`,
      [caseId],
    );
    await client.query(
      `UPDATE documents SET sample_id = NULL, fields = NULL, original_fields = NULL,
         issues = '[]'::jsonb, quality = NULL, confirmed = false,
         verification_status = 'unverified', updated_at = now()
       WHERE case_id = $1 AND type = 'REGISTRATION_CERT'`,
      [caseId],
    );
    await bumpMaterials(client, caseId);
    await appendEvent(client, caseId, {
      type: "material_missing",
      payload: {
        documentType: "REGISTRATION_CERT",
        note: "登记证暂时找不到；说明为演示核对，不代表官方批准。",
      },
      source: "user",
      demo: true,
    });
  });
  await syncTasks(caseId);
}

export async function documentAssetsFor(caseId: string) {
  const docs = await loadDocuments(caseId);
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    sampleId: d.sampleId,
  }));
}

export async function registrationSampleMissing(caseId: string): Promise<boolean> {
  const [fields, docs] = await Promise.all([loadFields(caseId), loadDocuments(caseId)]);
  const status = fieldValue(fields, "documentsStatus");
  const reg = docs.find((d) => d.type === "REGISTRATION_CERT");
  return status === "missing_registration" && !reg?.sampleId;
}

export function inferVehicleRegion(fields: Awaited<ReturnType<typeof loadFields>>): RegionValue | null {
  return (fieldValue(fields, "vehicleLocation") as RegionValue | null) ?? null;
}