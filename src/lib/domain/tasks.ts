import type {
  EvidenceStatus,
  Intent,
  OwnerRelation,
  SubsidyStatus,
  TaskKind,
  TaskRecord,
} from "@/lib/types";

export const TASK_ORDER: TaskKind[] = [
  "unsupported_case",
  "confirm_authorization",
  "review_missing_document",
  "confirm_materials",
  "confirm_quote",
  "confirm_appointment",
  "obtain_recovery_certificate",
  "verify_recovery_certificate",
  "verify_deregistration",
  "confirm_payment",
  "subsidy_followup",
];

export const TASK_META: Record<
  TaskKind,
  { title: string; owner: string; reason: string }
> = {
  unsupported_case: {
    title: "先核对特殊情形",
    owner: "协助角色",
    reason: "存在抵押、权属不明或非支持车型等情况，常规办理判定先暂停。",
  },
  confirm_authorization: {
    title: "补授权与代办核对",
    owner: "车主本人",
    reason: "由家人或他人协助办理，需要车主授权与代办材料核对。",
  },
  review_missing_document: {
    title: "核对登记证缺失的处理方式",
    owner: "协助角色",
    reason: "登记证暂时缺失，需核对拟办理所在地接受的情况说明或替代材料。",
  },
  confirm_materials: {
    title: "确认材料信息",
    owner: "你",
    reason: "计划内的材料尚未全部确认，请上传照片并核对字段。",
  },
  confirm_quote: {
    title: "选择并确认报价",
    owner: "你",
    reason: "还没有有效报价，或报价因情况变化需要重新确认。",
  },
  confirm_appointment: {
    title: "确认预约",
    owner: "你",
    reason: "需要确认服务方、时段、地点与费用摘要。",
  },
  obtain_recovery_certificate: {
    title: "取得回收证明",
    owner: "回收企业",
    reason: "车辆已交接，但尚未收到可核对的回收证明。",
  },
  verify_recovery_certificate: {
    title: "核对回收证明",
    owner: "协助角色",
    reason: "回收证明已提供，仍需核对车辆信息与证明内容。",
  },
  verify_deregistration: {
    title: "核对注销结果",
    owner: "登记地交管受理渠道",
    reason: "注销证明已提供，尚未完成核验；交车或回收证明不等于注销完成。",
  },
  confirm_payment: {
    title: "确认回收款到账",
    owner: "你",
    reason: "企业付款反馈与车主实际到账分开记录，需要你本人确认到账。",
  },
  subsidy_followup: {
    title: "补齐补贴核对信息",
    owner: "你",
    reason: "换新补贴需要单独核实，不随回收或注销自动推进。",
  },
};

export type AppointmentState =
  | "none"
  | "booked"
  | "needs_reconfirmation"
  | "cancelled";

export type SettlementState =
  | "none"
  | "quote_selected"
  | "awaiting_payment"
  | "notice"
  | "confirmed"
  | "disputed";

export type PlanSnapshot = {
  specialCase: string | null;
  ownerRelation: OwnerRelation;
  authorizationResolved: boolean;
  documentsStatus: string;
  missingResolutionValid: boolean;
  requiredDocuments: number;
  confirmedDocuments: number;
  selectedQuoteValid: boolean;
  appointmentStatus: AppointmentState;
  handedOver: boolean;
  recovery: EvidenceStatus | "absent";
  deregistration: EvidenceStatus | "absent";
  settlement: SettlementState;
  intent: Intent;
  subsidyStatus: SubsidyStatus;
};

export type TaskCandidate = {
  kind: TaskKind;
  title: string;
  owner: string;
  reason: string;
  order: number;
};

/**
 * 按规格第 10 节的固定顺序计算任务。
 * 同一阶段只返回一个 kind（去重），是否已解决由 snapshot 中的状态表达。
 */
export function evaluateTasks(snapshot: PlanSnapshot): TaskCandidate[] {
  const kinds: TaskKind[] = [];

  if (snapshot.specialCase) kinds.push("unsupported_case");
  if (snapshot.ownerRelation === "family" && !snapshot.authorizationResolved) {
    kinds.push("confirm_authorization");
  }
  if (
    snapshot.documentsStatus === "missing_registration" &&
    !snapshot.missingResolutionValid
  ) {
    kinds.push("review_missing_document");
  }
  if (
    snapshot.requiredDocuments > 0 &&
    snapshot.confirmedDocuments < snapshot.requiredDocuments
  ) {
    kinds.push("confirm_materials");
  }
  if (!snapshot.selectedQuoteValid) kinds.push("confirm_quote");
  if (
    snapshot.appointmentStatus === "none" ||
    snapshot.appointmentStatus === "needs_reconfirmation" ||
    snapshot.appointmentStatus === "cancelled"
  ) {
    kinds.push("confirm_appointment");
  }
  if (snapshot.handedOver && snapshot.recovery === "absent") {
    kinds.push("obtain_recovery_certificate");
  }
  if (
    snapshot.recovery === "provided" ||
    snapshot.recovery === "pending_check"
  ) {
    kinds.push("verify_recovery_certificate");
  }
  if (
    snapshot.deregistration === "provided" ||
    snapshot.deregistration === "pending_check"
  ) {
    kinds.push("verify_deregistration");
  }
  if (
    snapshot.handedOver &&
    snapshot.settlement !== "confirmed" &&
    snapshot.settlement !== "disputed"
  ) {
    kinds.push("confirm_payment");
  }
  if (
    snapshot.intent === "replace" &&
    (snapshot.subsidyStatus === "info_pending" ||
      snapshot.subsidyStatus === "materials_pending")
  ) {
    kinds.push("subsidy_followup");
  }

  const unique = Array.from(new Set(kinds));
  return unique
    .map((kind) => ({
      kind,
      title: TASK_META[kind].title,
      owner: TASK_META[kind].owner,
      reason: TASK_META[kind].reason,
      order: TASK_ORDER.indexOf(kind),
    }))
    .sort((a, b) => a.order - b.order);
}

export function selectNextAction(
  tasks: Pick<TaskRecord, "kind" | "status" | "active">[],
): TaskRecord | null {
  const ordered = [...tasks]
    .filter(
      (t) => t.active && (t.status === "open" || t.status === "needs_reconfirmation"),
    )
    .sort((a, b) => TASK_ORDER.indexOf(a.kind) - TASK_ORDER.indexOf(b.kind));
  return (ordered[0] as TaskRecord | undefined) ?? null;
}

export function stageNote(snapshot: PlanSnapshot): string {
  if (
    snapshot.handedOver &&
    snapshot.recovery === "demo_verified" &&
    snapshot.deregistration === "demo_verified" &&
    snapshot.settlement === "confirmed"
  ) {
    return snapshot.intent === "replace"
      ? "报废与结算阶段完成，补贴仍待官方渠道核实。"
      : "本次报废已完成。所有完成状态均来自显式事件。";
  }
  if (snapshot.handedOver) {
    return "车辆已交接，注销与到账仍需分别确认，时间流逝不会自动完成。";
  }
  return "按顺序完成上面的任务；已确认的信息可以在对应页面修改。";
}