import { describe, expect, it } from "vitest";
import {
  canChangeBooking,
  deriveDeregistrationStatus,
  deriveSettlementStatus,
  deriveTracks,
  subsidyAfterIntentChange,
  type TrackInput,
} from "@/lib/domain/status";

const base: TrackInput = {
  intent: "scrap",
  quoteSelected: true,
  appointmentStatus: "booked",
  handedOver: false,
  recovery: "absent",
  deregistration: "absent",
  settlement: "quote_selected",
  subsidyStatus: "inactive",
};

describe("状态不变量", () => {
  it("交车或取得回收证明都不完成注销", () => {
    expect(deriveDeregistrationStatus({ deregistration: "absent", handedOver: true })).toBe(
      "awaiting_materials",
    );
    expect(deriveDeregistrationStatus({ deregistration: "absent", handedOver: false })).toBe(
      "not_started",
    );
  });

  it("注销证明提供后只到待核验", () => {
    expect(
      deriveDeregistrationStatus({ deregistration: "provided", handedOver: true }),
    ).toBe("pending_check");
    expect(
      deriveDeregistrationStatus({ deregistration: "demo_verified", handedOver: true }),
    ).toBe("demo_verified");
  });

  it("付款通知不等于到账", () => {
    expect(
      deriveSettlementStatus({
        ...base,
        handedOver: true,
        settlement: "notice",
      }),
    ).toBe("notice");
    expect(
      deriveSettlementStatus({
        ...base,
        handedOver: true,
        settlement: "confirmed",
      }),
    ).toBe("confirmed");
  });

  it("四条业务线独立：回收证明核验不推进注销和到账", () => {
    const tracks = deriveTracks({
      ...base,
      handedOver: true,
      recovery: "demo_verified",
      deregistration: "absent",
      settlement: "awaiting_payment",
      subsidyStatus: "inactive",
    });
    expect(tracks.find((t) => t.key === "recovery")?.status).toBe("handed_over");
    expect(tracks.find((t) => t.key === "deregistration")?.status).not.toBe(
      "demo_verified",
    );
    expect(tracks.find((t) => t.key === "settlement")?.status).not.toBe("confirmed");
  });

  it("仅报废时补贴未参与；换新切换只暂停/恢复", () => {
    expect(deriveTracks(base).find((t) => t.key === "subsidy")?.status).toBe(
      "inactive",
    );
    expect(subsidyAfterIntentChange("scrap", "materials_pending")).toBe("paused");
    expect(subsidyAfterIntentChange("replace", "paused")).toBe("info_pending");
    expect(subsidyAfterIntentChange("replace", "materials_pending")).toBe(
      "materials_pending",
    );
  });

  it("交接后禁止常规取消与重选", () => {
    expect(canChangeBooking(false)).toBe(true);
    expect(canChangeBooking(true)).toBe(false);
  });
});