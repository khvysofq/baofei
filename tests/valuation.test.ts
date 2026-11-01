import { describe, expect, it } from "vitest";
import {
  buildValuationReport,
  decodeVin,
  isValidVin,
  normalizeVin,
} from "@/lib/valuation/engine";

const NOW = new Date("2026-11-01T08:00:00Z");
const SAMPLE_VIN = "LSVAA49J5C2345678";

describe("VIN 解析", () => {
  it("接受 17 位合法字符并统一大写", () => {
    expect(normalizeVin(" lsv aa49j5c2345678 ")).toBe(SAMPLE_VIN);
    expect(isValidVin(SAMPLE_VIN)).toBe(true);
  });

  it("拒绝长度不对或包含 I/O/Q 的 VIN", () => {
    expect(isValidVin("LSVAA49J5C234567")).toBe(false);
    expect(isValidVin("LSVAA49J5C23456789")).toBe(false);
    expect(isValidVin("LSVAA49J5C234567I")).toBe(false);
    expect(isValidVin("LSVAA49J5C234567O")).toBe(false);
  });

  it("拒绝国标校验位不匹配的 VIN", () => {
    // 第 9 位应为 5，这里填 1
    expect(isValidVin("LSVAA49J1C2345678")).toBe(false);
  });

  it("按 WMI 与年款位解析品牌和年份", () => {
    const decoded = decodeVin(SAMPLE_VIN);
    expect(decoded.brand).toBe("大众牌");
    expect(decoded.year).toBe(2012);
    expect(decoded.vehicleType).toBe("小型轿车");

    const wuling = decodeVin("LZWADAGA3F8123456");
    expect(wuling.brand).toBe("五菱牌");
    expect(wuling.year).toBe(2015);
  });
});

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

  it("VIN 模式不编造号牌与首次登记日期，并标记推定字段", () => {
    const report = buildValuationReport({
      seed: "0123456789abcdef".repeat(4),
      source: "vin",
      vin: SAMPLE_VIN,
      now: NOW,
    });

    expect(report.source).toBe("vin");
    expect(report.profile.plate).toBeNull();
    expect(report.profile.registerDate).toBeNull();
    expect(report.profile.registerNote).toContain("2012");
    expect(report.profile.vin).toBe(SAMPLE_VIN);
    expect(report.estimatedFields).toContain("整备质量");
    expect(report.netLowFen).toBeLessThan(report.netMidFen);
  });

  it("自行送车时不计拖运费，区间整体上移", () => {
    const report = buildValuationReport({ seed: "a".repeat(64), now: NOW });

    expect(report.towingFen).toBeGreaterThan(0);
    expect(report.netMidNoTowingFen).toBeGreaterThan(report.netMidFen);
    expect(report.netLowNoTowingFen).toBeLessThan(report.netMidNoTowingFen);
    expect(report.netHighNoTowingFen).toBeGreaterThan(report.netMidNoTowingFen);
    expect(
      Math.abs(report.netMidNoTowingFen - report.netMidFen - report.towingFen),
    ).toBeLessThanOrEqual(1000);
  });

  it("铁轮毂按整备质量每吨减 400 元", () => {
    const report = buildValuationReport({ seed: "a".repeat(64), now: NOW });

    expect(report.ironWheelDeductionFen).toBe(
      Math.round(40 * report.profile.curbWeightKg),
    );
    expect(report.ironWheelDeductionFen).toBeGreaterThan(0);
  });

  it("同一份文件摘要得到同一份报告，编号稳定", () => {
    const seed = "0123456789abcdef".repeat(4);
    const first = buildValuationReport({ seed, now: NOW });
    const second = buildValuationReport({ seed, now: NOW });

    expect(second.reportNo).toBe(first.reportNo);
    expect(second.netMidFen).toBe(first.netMidFen);
    expect(second.reportNo).toMatch(/^BF-\d{8}-[0-9A-F]{4}$/);
  });

  it("样例行驶证固定返回演示轿车并给出有效区间", () => {
    const report = buildValuationReport({ seed: "f".repeat(64), sample: true, now: NOW });

    expect(report.source).toBe("license");
    expect(report.profile.plate).toBe("川A·8K3L9");
    expect(report.profile.curbWeightKg).toBe(1320);
    expect(report.netLowFen).toBeLessThan(report.netMidFen);
    expect(report.validUntil).toBe("2026-11-08");
    expect(report.mode).toBe("demo");
  });
});