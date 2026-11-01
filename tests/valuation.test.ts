import { describe, expect, it } from "vitest";
import { buildValuationReport } from "@/lib/valuation/engine";

const NOW = new Date("2026-11-01T08:00:00Z");

describe("报废残值评估引擎", () => {
  it("毛残值等于各项之和，且区间包含中值", () => {
    const report = buildValuationReport({ seed: "a".repeat(64), now: NOW });
    const sum = report.items.reduce((total, item) => total + item.amountFen, 0);

    expect(report.items).toHaveLength(6);
    expect(report.grossFen).toBe(sum);
    expect(report.netLowFen).toBeLessThan(report.netMidFen);
    expect(report.netHighFen).toBeGreaterThan(report.netMidFen);
    expect(report.deductionsFen).toBe(
      report.deductions.reduce((total, item) => total + item.amountFen, 0),
    );
  });

  it("同一份文件摘要得到同一份报告，编号稳定", () => {
    const seed = "0123456789abcdef".repeat(4);
    const first = buildValuationReport({ seed, now: NOW });
    const second = buildValuationReport({ seed, now: NOW });

    expect(second.reportNo).toBe(first.reportNo);
    expect(second.netMidFen).toBe(first.netMidFen);
    expect(second.reportNo).toMatch(/^BF-\d{8}-[0-9A-F]{4}$/);
  });

  it("样例固定返回演示轿车并给出有效区间", () => {
    const report = buildValuationReport({ seed: "f".repeat(64), sample: true, now: NOW });

    expect(report.profile.plate).toBe("川A·8K3L9");
    expect(report.profile.curbWeightKg).toBe(1320);
    expect(report.ageYears).toBeGreaterThan(13);
    expect(report.netLowFen).toBeLessThan(report.netMidFen);
    expect(report.validUntil).toBe("2026-11-08");
    expect(report.mode).toBe("demo");
  });
});