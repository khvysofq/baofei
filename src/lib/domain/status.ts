import type {
  EvidenceStatus,
  Intent,
  SubsidyStatus,
  TrackState,
} from "@/lib/types";
import type { AppointmentState, SettlementState } from "@/lib/domain/tasks";

export type TrackInput = {
  intent: Intent;
  quoteSelected: boolean;
  appointmentStatus: AppointmentState;
  handedOver: boolean;
  recovery: EvidenceStatus | "absent";
  deregistration: EvidenceStatus | "absent";
  settlement: SettlementState;
  subsidyStatus: SubsidyStatus;
};

export function deriveRecoveryStatus(input: TrackInput): string {
  if (input.handedOver) return "handed_over";
  if (input.appointmentStatus === "booked") return "awaiting_handover";
  if (input.quoteSelected) return "awaiting_booking";
  return "not_selected";
}

/**
 * 注销状态只由注销证明与核验事件决定。
 * 交车、企业接收、回收证明都不推进注销。
 */
export function deriveDeregistrationStatus(
  input: Pick<TrackInput, "deregistration" | "handedOver">,
): string {
  if (input.deregistration === "demo_verified") return "demo_verified";
  if (input.deregistration === "rejected") return "rejected";
  if (
    input.deregistration === "provided" ||
    input.deregistration === "pending_check"
  ) {
    return "pending_check";
  }
  if (input.handedOver) return "awaiting_materials";
  return "not_started";
}

/**
 * 付款通知 ≠ 车主到账。只有显式确认到账事件把状态推进到 confirmed。
 */
export function deriveSettlementStatus(input: TrackInput): SettlementState {
  if (input.settlement === "confirmed") return "confirmed";
  if (input.settlement === "disputed") return "disputed";
  if (input.settlement === "notice") return "notice";
  if (input.handedOver) return "awaiting_payment";
  if (input.quoteSelected) return "quote_selected";
  return "none";
}

const RECOVERY_LABELS: Record<string, [string, TrackState["tone"]]> = {
  not_selected: ["未选择", "neutral"],
  awaiting_booking: ["待预约", "waiting"],
  awaiting_handover: ["待交车", "waiting"],
  handed_over: ["已交接", "done"],
};

const DEREG_LABELS: Record<string, [string, TrackState["tone"]]> = {
  not_started: ["未开始", "neutral"],
  awaiting_materials: ["待材料", "waiting"],
  pending_check: ["已提供 待核验", "warn"],
  demo_verified: ["已核验", "done"],
  rejected: ["核对未通过", "danger"],
};

const SETTLEMENT_LABELS: Record<string, [string, TrackState["tone"]]> = {
  none: ["未报价", "neutral"],
  quote_selected: ["报价已选", "waiting"],
  awaiting_payment: ["待付款", "waiting"],
  notice: ["付款反馈 待确认到账", "warn"],
  confirmed: ["已确认到账", "done"],
  disputed: ["争议待处理", "danger"],
};

const SUBSIDY_LABELS: Record<string, [string, TrackState["tone"]]> = {
  inactive: ["未参与", "neutral"],
  paused: ["已暂停 保留内容", "neutral"],
  info_pending: ["信息待核实", "warn"],
  materials_pending: ["材料准备中", "waiting"],
  awaiting_official: ["待官方渠道核实", "warn"],
};

export const TRACK_META: Record<string, { label: string; next: string }> = {
  recovery: {
    label: "车辆回收",
    next: "交接后仍需取得回收证明，并由企业回传交接记录。",
  },
  deregistration: {
    label: "机动车注销",
    next: "交车与回收证明不等于注销完成；需提供注销证明并完成核验。",
  },
  settlement: {
    label: "回收款",
    next: "付款反馈与车主到账分开记录，到账需要你显式确认。",
  },
  subsidy: {
    label: "补贴",
    next: "补贴与回收净额独立，本版只给待核实清单，不计算金额。",
  },
};

export function deriveTracks(input: TrackInput): TrackState[] {
  const recovery = deriveRecoveryStatus(input);
  const deregistration = deriveDeregistrationStatus(input);
  const settlement = deriveSettlementStatus(input);
  const subsidy = input.intent === "replace" ? input.subsidyStatus : "inactive";

  const [recLabel, recTone] = RECOVERY_LABELS[recovery] ?? ["未选择", "neutral"];
  const [deregLabel, deregTone] = DEREG_LABELS[deregistration] ?? ["未开始", "neutral"];
  const [settleLabel, settleTone] = SETTLEMENT_LABELS[settlement] ?? ["未报价", "neutral"];
  const [subsidyLabel, subsidyTone] = SUBSIDY_LABELS[subsidy] ?? ["未参与", "neutral"];

  return [
    {
      key: "recovery",
      label: "车辆回收",
      status: recovery,
      statusLabel: recLabel,
      tone: recTone,
      basis:
        recovery === "handed_over"
          ? "企业交接回执已记录。"
          : "尚未记录交接回执。",
      next: TRACK_META.recovery.next,
    },
    {
      key: "deregistration",
      label: "机动车注销",
      status: deregistration,
      statusLabel: deregLabel,
      tone: deregTone,
      basis:
        deregistration === "pending_check"
          ? "已收到注销证明样例，等待核验。"
          : deregistration === "demo_verified"
            ? "注销证明已通过核验事件。"
            : "缺少可核对的注销结果。",
      next: TRACK_META.deregistration.next,
    },
    {
      key: "settlement",
      label: "回收款",
      status: settlement,
      statusLabel: settleLabel,
      tone: settleTone,
      basis:
        settlement === "notice"
          ? "企业付款反馈已记录，但尚未由你确认到账。"
          : settlement === "confirmed"
            ? "你已通过显式事件确认到账。"
            : "回收款状态独立于注销与补贴。",
      next: TRACK_META.settlement.next,
    },
    {
      key: "subsidy",
      label: "补贴",
      status: subsidy,
      statusLabel: subsidyLabel,
      tone: subsidyTone,
      basis:
        input.intent === "replace"
          ? "补贴待办与回收净额独立；本版不计算补贴金额。"
          : "当前目标为仅报废，补贴待办未参与排序。",
      next: TRACK_META.subsidy.next,
    },
  ];
}

/** 交接后禁用常规取消、重选服务方与重订预约。 */
export function canChangeBooking(handedOver: boolean): boolean {
  return !handedOver;
}

/** 补贴切换只暂停/恢复待办，不得改写回收净额。 */
export function subsidyAfterIntentChange(
  activeIntent: Intent,
  previousStatus: SubsidyStatus,
): SubsidyStatus {
  if (activeIntent === "replace") {
    return previousStatus === "inactive" || previousStatus === "paused"
      ? "info_pending"
      : previousStatus;
  }
  return previousStatus === "inactive" ? "inactive" : "paused";
}