import type { RegionValue } from "@/lib/types";
import { regionLabel } from "@/lib/domain/regions";
import { withTransaction } from "@/lib/db";
import { fieldValue } from "@/lib/services/store";
import { loadCaseState } from "@/lib/services/plan";
import { appendEvent } from "@/lib/services/events";
import { syncTasks } from "@/lib/services/plan";

export const HELP_KINDS = [
  { id: "mortgage", label: "抵押或状态不明" },
  { id: "battery", label: "新能源电池情况不明" },
  { id: "cross_region", label: "省外或跨省登记" },
  { id: "non_supported", label: "非支持车型或复杂情形" },
] as const;

export type HelpKind = (typeof HELP_KINDS)[number]["id"];

export type HelpCard = {
  kind: HelpKind;
  kindLabel: string;
  confirmedFacts: string[];
  vehicleRegion: string;
  registrationRegion: string;
  subsidyRegions: string;
  questions: string[];
  materials: string[];
  channel: string;
  blockingTask: string;
  note: string;
  demo: true;
};

const QUESTION_MAP: Record<HelpKind, string[]> = {
  mortgage: [
    "车辆是否存在抵押、质押或未解除的担保？",
    "登记证书上的抵押记录是否已经解除？",
  ],
  battery: [
    "车辆动力电池是否仍在车上、是否完整？",
    "是否为换电车型、租赁电池或电池权属不属于车主？",
  ],
  cross_region: [
    "登记地是否接受在车辆所在地办理回收与注销？",
    "回收企业是否承接该登记地的车辆？",
  ],
  non_supported: [
    "车辆是否为单位所有、营运性质或严重残缺？",
    "是否有权属争议或无法提供车主授权的情况？",
  ],
};

const CHANNEL_MAP: Record<HelpKind, string> = {
  mortgage: "登记地交管受理渠道；企业资质问题可向商务主管部门核对。",
  battery: "具备资质的回收拆解企业；电池回收问题可向工信部门渠道核对。",
  cross_region: "登记地交管受理渠道与拟办理地具备资质的回收企业。",
  non_supported: "当地商务主管部门与具备资质的回收拆解企业。",
};

const SPECIAL: Partial<Record<HelpKind, string>> = {
  mortgage: "mortgage",
  battery: "battery_unknown",
  non_supported: "non_supported",
};

export async function buildHelpCard(caseId: string, kind: HelpKind): Promise<HelpCard> {
  const state = await loadCaseState(caseId);
  if (!state) throw new Error("案件不存在");
  const meta = HELP_KINDS.find((k) => k.id === kind);
  if (!meta) throw new Error("未知协助类型");
  const vehicle = fieldValue(state.fields, "vehicleLocation") as RegionValue | null;
  const registration = fieldValue(state.fields, "registrationLocation") as RegionValue | null;
  const intent = fieldValue(state.fields, "intent");
  const drivable = fieldValue(state.fields, "drivable");
  const relation = fieldValue(state.fields, "ownerRelation");
  const facts: string[] = [
    `办理目标：${intent === "replace" ? "报废并换新" : intent === "scrap" ? "仅报废" : "待确认"}`,
    `行驶状况：${drivable === true ? "可行驶" : drivable === false ? "开不动，需拖运" : "待确认"}`,
    `办理关系：${relation === "family" ? "家人或他人协助" : relation === "self" ? "车主本人" : "待确认"}`,
  ];
  const materials: string[] = state.documents
    .filter((d) => d.sampleId)
    .map((d) => (d.type === "DRIVING_LICENSE" ? "行驶证（演示）" : d.type === "REGISTRATION_CERT" ? "登记证（演示）" : "授权核对（演示）"));
  if (state.plan.documentsStatus === "missing_registration") {
    materials.push("登记证缺失（待核对）");
  }
  const blocking =
    state.tasks.find((t) => t.active && t.status !== "resolved")?.kind ?? "none";
  return {
    kind,
    kindLabel: meta.label,
    confirmedFacts: facts,
    vehicleRegion: regionLabel(vehicle),
    registrationRegion: regionLabel(registration),
    subsidyRegions: state.subsidy
      ? `发票地区：${regionLabel(state.subsidy.invoiceRegion)}；受理市州：${state.subsidy.acceptingCity ?? "待确认"}`
      : "未参与补贴待办",
    questions: QUESTION_MAP[kind],
    materials: materials.length ? materials : ["尚未选择演示材料"],
    channel: CHANNEL_MAP[kind],
    blockingTask: blocking === "none" ? "当前没有阻塞任务" : `阻塞任务：${blocking}`,
    note: "本地交接卡，不发送任何信息；生成记录仅为演示，不代表人工客服已响应或官方已受理。",
    demo: true,
  };
}

export async function recordHelpCard(caseId: string, kind: HelpKind): Promise<HelpCard> {
  const card = await buildHelpCard(caseId, kind);
  const special = SPECIAL[kind];
  await withTransaction(async (client) => {
    if (special) {
      await client.query(
        `INSERT INTO case_fields (case_id, field, value, source, confirmed, confidence, updated_at)
         VALUES ($1,'specialCase',$2,'user',true,1,now())
         ON CONFLICT (case_id, field)
         DO UPDATE SET value = EXCLUDED.value, source = 'user', confirmed = true,
           confidence = 1, updated_at = now()`,
        [caseId, JSON.stringify(special)],
      );
    }
    await appendEvent(client, caseId, {
      type: "help_requested",
      payload: {
        topic: kind,
        note: "生成本地协助记录，不发送任何信息。",
        demo: true,
      },
      source: "user",
      demo: true,
    });
  });
  await syncTasks(caseId);
  return card;
}

/** 解决特殊情形阻断任务（演示核对说明必须写明，不写成官方批准）。 */
export async function resolveSpecialCase(caseId: string, note: string): Promise<void> {
  if (!note.trim()) throw new Error("请填写演示核对说明");
  const { resolveTask } = await import("@/lib/services/plan");
  await resolveTask(caseId, "unsupported_case", note);
}