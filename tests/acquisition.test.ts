import { describe, expect, it } from "vitest";
import {
  calcDeductionsFen,
  calcTowFen,
  pickTier,
  quoteAcquisition,
  resolveCategory,
} from "@/lib/valuation/acquisition";

describe("收购价 · 车型识别", () => {
  it("按行驶证车辆类型归类", () => {
    expect(resolveCategory({ vehicleType: "小型轿车" })).toBe("sedan_suv");
    expect(resolveCategory({ vehicleType: "小型普通客车" })).toBe("sedan_suv");
    expect(resolveCategory({ vehicleType: "轻型多用途货车" })).toBe("van_pickup");
    expect(resolveCategory({ vehicleType: "轻型厢式货车" })).toBe("truck");
    expect(resolveCategory({ vehicleType: "大型客车" })).toBe("bus_large");
    expect(resolveCategory({ vehicleType: "中型客车" })).toBe("bus_mid_no_ac");
    expect(resolveCategory({ vehicleType: "普通二轮摩托车" })).toBe("motorcycle");
  });

  it("认不出的车型不硬猜", () => {
    expect(resolveCategory({ vehicleType: "特种作业车" })).toBeNull();
  });
});

describe("收购价 · 档位", () => {
  it("小型车按重量分三档", () => {
    expect(pickTier("sedan_suv", 900)?.fenPerTon).toBe(300_000);
    expect(pickTier("sedan_suv", 1000)?.fenPerTon).toBe(300_000);
    expect(pickTier("sedan_suv", 1200)?.fenPerTon).toBe(330_000);
    expect(pickTier("sedan_suv", 1400)?.fenPerTon).toBe(330_000);
    expect(pickTier("sedan_suv", 1401)?.fenPerTon).toBe(360_000);
    expect(pickTier("sedan_suv", 1600)?.fenPerTon).toBe(360_000);
  });

  it("货车按吨位分四档", () => {
    expect(pickTier("truck", 2000)?.fenPerTon).toBe(175_000);
    expect(pickTier("truck", 5000)?.fenPerTon).toBe(185_000);
    expect(pickTier("truck", 8000)?.fenPerTon).toBe(195_000);
    expect(pickTier("truck", 12000)?.fenPerTon).toBe(205_000);
  });
});

describe("收购价 · 计算", () => {
  it("1.2 吨轿车按整备质量计价", () => {
    const q = quoteAcquisition({ category: "sedan_suv", weightKg: 1200 });
    expect(q.fenPerTon).toBe(330_000);
    expect(q.grossFen).toBe(396_000);
    expect(q.netFen).toBe(396_000);
  });

  it("铁圈缺失每吨减 400 元", () => {
    const q = quoteAcquisition({ category: "sedan_suv", weightKg: 1320, steelRims: true });
    expect(q.fenPerTon).toBe(290_000);
    expect(q.grossFen).toBe(382_800);
    expect(q.steelRimDiscount).toBe(true);
  });

  it("铁圈扣减只作用于小型车", () => {
    const q = quoteAcquisition({ category: "truck", weightKg: 5000, steelRims: true });
    expect(q.fenPerTon).toBe(185_000);
    expect(q.steelRimDiscount).toBe(false);
  });

  it("缺件按目录逐项扣减", () => {
    const q = quoteAcquisition({
      category: "sedan_suv",
      weightKg: 1200,
      deductions: [
        { code: "spare_tire", qty: 1 },
        { code: "alloy_rim", qty: 1 },
      ],
    });
    expect(q.deductionsFen).toBe(17_000);
    expect(q.netFen).toBe(379_000);
  });

  it("电瓶按车型分小车/大车", () => {
    const car = calcDeductionsFen([{ code: "battery_small", qty: 1 }], "sedan_suv");
    expect(car.totalFen).toBe(10_000);
    const truck = calcDeductionsFen([{ code: "battery_large", qty: 1 }], "truck");
    expect(truck.totalFen).toBe(20_000);
    expect(calcDeductionsFen([{ code: "battery_large", qty: 1 }], "sedan_suv").totalFen).toBe(0);
  });

  it("摩托车免费、火三轮按辆", () => {
    expect(quoteAcquisition({ category: "motorcycle", weightKg: null }).netFen).toBe(0);
    expect(quoteAcquisition({ category: "tricycle", weightKg: null }).netFen).toBe(50_000);
  });

  it("缺整备质量时不猜价格", () => {
    const q = quoteAcquisition({ category: "sedan_suv", weightKg: null });
    expect(q.grossFen).toBeNull();
    expect(q.netFen).toBeNull();
    expect(q.notices.join("")).toContain("缺少整备质量");
  });
});

describe("拖车费", () => {
  it("80 公里内免费，超出部分 5 元/公里", () => {
    expect(calcTowFen(30)).toBe(0);
    expect(calcTowFen(80)).toBe(0);
    expect(calcTowFen(150)).toBe(35_000);
    expect(calcTowFen(null)).toBeNull();
  });
});