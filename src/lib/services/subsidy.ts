import { normalizeProvinceName, normalizeRegion } from "@/lib/domain/regions";
import type { RegionValue, SubsidyContext, SubsidyStatus } from "@/lib/types";
import { withTransaction } from "@/lib/db";
import { loadCase, loadFields, loadSubsidy, fieldValue } from "@/lib/services/store";
import { appendEvent } from "@/lib/services/events";
import { syncTasks } from "@/lib/services/plan";

export const SUBSIDY_MATERIALS = [
  { id: "id_card", label: "身份证明" },
  { id: "invoice", label: "新车发票" },
  { id: "new_registration", label: "新车登记证" },
  { id: "old_car_recycle", label: "旧车回收证明" },
  { id: "old_car_deregistration", label: "旧车注销证明" },
  { id: "bank_account", label: "本人收款账户说明" },
] as const;

export const PURCHASE_STAGES = [
  { id: "not_bought", label: "还没买新车" },
  { id: "ordered", label: "已订车，票证未取得" },
  { id: "bought", label: "已购车，票证已取得" },
] as const;

export type PurchaseStage = (typeof PURCHASE_STAGES)[number]["id"];

export type SubsidyInput = {
  purchaseStage: PurchaseStage;
  plannedPurchaseRegion?: RegionValue | null;
  invoiceRegion?: RegionValue | null;
  newRegistrationProvince?: string | null;
  materials?: string[];
};

export type SubsidyView = {
  enabled: boolean;
  context: SubsidyContext | null;
  policyYear: number;
  acceptingCity: string | null;
  acceptingBasis: string;
  missing: string[];
  warnings: string[];
  statusLabel: string;
  windowStatusLabel: string;
  materials: typeof SUBSIDY_MATERIALS;
  stages: typeof PURCHASE_STAGES;
  sources: string[];
  note: string;
};

function statusLabel(status: SubsidyStatus): string {
  switch (status) {
    case "inactive":
      return "未参与";
    case "paused":
      return "已暂停，保留内容";
    case "info_pending":
      return "资格待核实 · 信息未齐";
    case "materials_pending":
      return "资格待核实 · 材料准备中";
    case "awaiting_official":
      return "资格待核实 · 待官方渠道核实";
  }
}

function normalizeProvinceInput(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return normalizeProvinceName(raw);
}

function normalizeRegionInput(raw: RegionValue | null | undefined): RegionValue | null {
  if (!raw) return null;
  const normalized = normalizeRegion(raw);
  if (!normalized.province && !normalized.city) return null;
  return normalized;
}

export function computeSubsidyIssues(input: {
  purchaseStage: PurchaseStage;
  invoiceRegion: RegionValue | null;
  newRegistrationProvince: string | null;
  materials: string[];
}): { status: SubsidyStatus; missing: string[]; warnings: string[]; acceptingCity: string | null } {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (input.purchaseStage !== "bought") {
    missing.push("取得新车发票（票证未取得前只保留计划值）");
    missing.push("取得新车登记证");
  }
  if (!input.invoiceRegion?.province) {
    missing.push("新车发票开具省份与市州");
  } else if (!input.invoiceRegion.city) {
    missing.push("新车发票开具市州（受理市州按发票市州确定）");
  } else if (input.invoiceRegion.province !== "四川") {
    warnings.push("新车发票开具地不在四川省内，需要核对是否符合本期细则。");
    missing.push("四川省内新车发票");
  }
  if (!input.newRegistrationProvince) {
    missing.push("新车登记省份");
  } else if (input.newRegistrationProvince !== "四川") {
    warnings.push("新车登记省份不是四川，需要按官方细则核对是否满足条件。");
    missing.push("四川省内新车登记");
  }
  const need: { id: string; label: string }[] = [
    { id: "id_card", label: "身份证明" },
    { id: "invoice", label: "新车发票" },
    { id: "new_registration", label: "新车登记证" },
    { id: "old_car_recycle", label: "旧车回收证明" },
    { id: "old_car_deregistration", label: "旧车注销证明" },
  ];
  for (const item of need) {
    if (!input.materials.includes(item.id)) missing.push(`准备材料：${item.label}`);
  }

  const acceptingCity =
    input.invoiceRegion?.province === "四川" ? input.invoiceRegion.city ?? null : null;

  let status: SubsidyStatus;
  if (missing.length === 0) status = "awaiting_official";
  else if (input.purchaseStage !== "bought" || !input.invoiceRegion?.province) {
    status = "info_pending";
  } else {
    status = "materials_pending";
  }
  return { status, missing, warnings, acceptingCity };
}

export async function getSubsidyView(caseId: string): Promise<SubsidyView> {
  const [caseRecord, subsidy, fields] = await Promise.all([
    loadCase(caseId),
    loadSubsidy(caseId),
    loadFields(caseId),
  ]);
  if (!caseRecord) throw new Error("案件不存在");
  const intent = fieldValue(fields, "intent");
  const enabled = intent === "replace";
  const invoiceRegion = subsidy?.invoiceRegion ?? null;
  const newRegistrationProvince = subsidy?.newRegistrationProvince ?? null;
  const materials = subsidy?.materials ?? [];
  const issues = computeSubsidyIssues({
    purchaseStage: subsidy?.purchaseStage ?? "not_bought",
    invoiceRegion,
    newRegistrationProvince,
    materials,
  });
  return {
    enabled,
    context: subsidy,
    policyYear: subsidy?.policyYear ?? 2026,
    acceptingCity: subsidy?.acceptingCity ?? issues.acceptingCity,
    acceptingBasis: invoiceRegion?.city
      ? "受理市州按新车发票开具市州推导"
      : "发票尚未取得，受理市州待确认",
    missing: invoiceRegion || subsidy ? issues.missing : [],
    warnings: issues.warnings,
    statusLabel: enabled
      ? statusLabel(subsidy?.status ?? "info_pending")
      : intent === "scrap"
        ? "未参与（当前为仅报废）"
        : "待确认办理目标",
    windowStatusLabel: "当期开放情况待查当期公告",
    materials: SUBSIDY_MATERIALS,
    stages: PURCHASE_STAGES,
    sources: ["S4", "S5", "S7"],
    note: "本服务只给出待核实清单，不计算补贴金额，也不给出资格通过结论。回收净额不受补贴状态影响。",
  };
}

export async function saveSubsidy(caseId: string, input: SubsidyInput): Promise<void> {
  const stage = PURCHASE_STAGES.find((s) => s.id === input.purchaseStage);
  if (!stage) throw new Error("请选择新车购买阶段");
  const planned = normalizeRegionInput(input.plannedPurchaseRegion);
  const invoice = normalizeRegionInput(input.invoiceRegion);
  const province = normalizeProvinceInput(input.newRegistrationProvince);
  const materials = Array.from(new Set(input.materials ?? [])).filter((id) =>
    SUBSIDY_MATERIALS.some((m) => m.id === id),
  );

  const issues = computeSubsidyIssues({
    purchaseStage: input.purchaseStage,
    invoiceRegion: invoice,
    newRegistrationProvince: province,
    materials,
  });

  await withTransaction(async (client) => {
    const caseRecord = await loadCase(caseId, client);
    if (!caseRecord) throw new Error("案件不存在");
    if (caseRecord.intent !== "replace") {
      throw new Error("当前办理目标不是换新；切回换新后才能保存补贴待办。");
    }
    await client.query(
      `INSERT INTO subsidy_contexts
        (case_id, active, status, policy_year, purchase_stage, planned_purchase_region, invoice_region,
         new_registration_province, accepting_city, window_status, materials, updated_at)
       VALUES ($1,true,$2,2026,$3,$4,$5,$6,$7,'unknown',$8,now())
       ON CONFLICT (case_id) DO UPDATE SET
         active = true, status = EXCLUDED.status,
         purchase_stage = EXCLUDED.purchase_stage,
         planned_purchase_region = EXCLUDED.planned_purchase_region,
         invoice_region = EXCLUDED.invoice_region,
         new_registration_province = EXCLUDED.new_registration_province,
         accepting_city = EXCLUDED.accepting_city,
         materials = EXCLUDED.materials,
         updated_at = now()`,
      [
        caseId,
        issues.status,
        input.purchaseStage,
        JSON.stringify(planned),
        JSON.stringify(invoice),
        province,
        issues.acceptingCity,
        JSON.stringify(materials),
      ],
    );
    await appendEvent(client, caseId, {
      type: "subsidy_saved",
      payload: {
        status: issues.status,
        acceptingCity: issues.acceptingCity,
        materials,
        note: "仅保存待核实信息；不计金额、不给资格结论。",
      },
      source: "user",
      demo: true,
    });
  });
  await syncTasks(caseId);
}