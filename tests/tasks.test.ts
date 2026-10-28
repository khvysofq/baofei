import { describe, expect, it } from "vitest";
import {
  evaluateTasks,
  selectNextAction,
  TASK_ORDER,
  type PlanSnapshot,
} from "@/lib/domain/tasks";

const base: PlanSnapshot = {
  specialCase: null,
  ownerRelation: "self",
  authorizationResolved: true,
  documentsStatus: "complete",
  missingResolutionValid: false,
  requiredDocuments: 2,
  confirmedDocuments: 2,
  selectedQuoteValid: true,
  appointmentStatus: "booked",
  handedOver: false,
  recovery: "absent",
  deregistration: "absent",
  settlement: "quote_selected",
  intent: "scrap",
  subsidyStatus: "inactive",
};

describe("任务选择顺序", () => {
  it("任务按 11 级固定顺序排列且不重复", () => {
    const tasks = evaluateTasks({
      ...base,
      specialCase: "mortgage",
      ownerRelation: "family",
      authorizationResolved: false,
      documentsStatus: "missing_registration",
      confirmedDocuments: 0,
      selectedQuoteValid: false,
      appointmentStatus: "none",
      handedOver: true,
      recovery: "absent",
      deregistration: "provided",
      settlement: "awaiting_payment",
      intent: "replace",
      subsidyStatus: "materials_pending",
    });
    expect(tasks.map((t) => t.kind)).toEqual([
      "unsupported_case",
      "confirm_authorization",
      "review_missing_document",
      "confirm_materials",
      "confirm_quote",
      "confirm_appointment",
      "obtain_recovery_certificate",
      "verify_deregistration",
      "confirm_payment",
      "subsidy_followup",
    ]);
    expect(new Set(tasks.map((t) => t.kind)).size).toBe(tasks.length);
    const indices = tasks.map((t) => TASK_ORDER.indexOf(t.kind));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it("回收证明已提供时进入核验顺序位，而不是重复取得任务", () => {
    const tasks = evaluateTasks({
      ...base,
      handedOver: true,
      recovery: "provided",
      settlement: "awaiting_payment",
    });
    expect(tasks.map((t) => t.kind)).toContain("verify_recovery_certificate");
    expect(tasks.map((t) => t.kind)).not.toContain("obtain_recovery_certificate");
    const expectedOrder = TASK_ORDER.filter((k) =>
      ["confirm_payment", "verify_recovery_certificate"].includes(k),
    );
    expect(tasks.map((t) => t.kind).filter((k) => expectedOrder.includes(k))).toEqual(
      expectedOrder,
    );
  });

  it("同一阶段不重复创建相同任务", () => {
    const tasks = evaluateTasks({
      ...base,
      specialCase: "mortgage",
      ownerRelation: "family",
      documentsStatus: "missing_registration",
      confirmedDocuments: 0,
      selectedQuoteValid: false,
      appointmentStatus: "none",
    });
    expect(new Set(tasks.map((t) => t.kind)).size).toBe(tasks.length);
  });

  it("仅报废时补贴任务不参与排序", () => {
    const tasks = evaluateTasks({
      ...base,
      intent: "scrap",
      subsidyStatus: "materials_pending",
    });
    expect(tasks.some((t) => t.kind === "subsidy_followup")).toBe(false);
  });

  it("nextAction 取第一条未解决任务", () => {
    const next = selectNextAction([
      {
        kind: "subsidy_followup",
        active: true,
        status: "open",
      },
      {
        kind: "confirm_quote",
        active: true,
        status: "needs_reconfirmation",
      },
    ]);
    expect(next?.kind).toBe("confirm_quote");
  });
});