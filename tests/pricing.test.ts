import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING,
  DEFAULT_QUOTE_OPTIONS,
  computeQuote,
  pickPricingTier,
  resolvePricingCategory,
  validatePricingConfig,
  type VehicleProfile,
} from "@/lib/valuation/pricing";

const SEDAN: VehicleProfile = {
  vin: "LSVAA49J5C2345678",
  brandModel: "大众牌 FV7160",
  vehicleType: "小型轿车",
  vehicleClass: "sedan",
  seats: 5,
  isCommercial: false,
  weightKg: 1200,
  weightSource: "vin",
  energyType: "gasoline",
  fuelType: "汽油",
  displacementMl: 1598,
  modelYear: 2012,
  emission: "国 IV",
};

function category(code: (typeof DEFAULT_PRICING.categories)[number]["code"]) {
  const found = DEFAULT_PRICING.categories.find((item) => item.code === code);
  if (!found) throw new Error(`missing category ${code}`);
  return found;
}

function quoteWith(
  vehicle: VehicleProfile,
  options: Partial<typeof DEFAULT_QUOTE_OPTIONS> = {},
) {
  return computeQuote({
    vehicle,
    pricing: DEFAULT_PRICING,
    options: { ...DEFAULT_QUOTE_OPTIONS, missingParts: {}, ...options },
  });
}

describe("定价 · 车型分类", () => {
  it("MPV 归商务车，不按展示用「小型普通客车」误判", () => {
    expect(
      resolvePricingCategory({
        vehicleClass: "mpv",
        vehicleType: "小型普通客车",
        seats: 7,
      }),
    ).toBe("business");
  });

  it("非营运面包车归面包车 / 皮卡", () => {
    expect(
      resolvePricingCategory({
        vehicleClass: "van",
        isCommercial: false,
        vehicleType: "小型普通客车",
      }),
    ).toBe("van_pickup");
    expect(
      resolvePricingCategory({
        vehicleClass: "van",
        isCommercial: null,
        vehicleType: "面包车",
      }),
    ).toBe("van_pickup");
  });

  it("营运面包车归货车", () => {
    expect(
      resolvePricingCategory({
        vehicleClass: "van",
        isCommercial: true,
        vehicleType: "轻型厢式货车",
      }),
    ).toBe("truck");
  });

  it("车辆分类缺失时才退回文本识别", () => {
    expect(resolvePricingCategory({ vehicleType: "普通二轮摩托车" })).toBe("motorcycle");
    expect(resolvePricingCategory({ vehicleType: "火三轮" })).toBe("tricycle");
    expect(resolvePricingCategory({ vehicleType: "特种作业车" })).toBeNull();
  });
});

describe("定价 · 档位选择", () => {
  it("小型车三档按上限命中，超过最后一档仍取最后一档", () => {
    expect(pickPricingTier(category("sedan_suv"), 900)?.fenPerTon).toBe(300_000);
    expect(pickPricingTier(category("sedan_suv"), 1000)?.fenPerTon).toBe(300_000);
    expect(pickPricingTier(category("sedan_suv"), 1200)?.fenPerTon).toBe(330_000);
    expect(pickPricingTier(category("sedan_suv"), 1400)?.fenPerTon).toBe(330_000);
    expect(pickPricingTier(category("sedan_suv"), 1401)?.fenPerTon).toBe(360_000);
  });

  it("货车四档按吨位命中", () => {
    expect(pickPricingTier(category("truck"), 2000)?.fenPerTon).toBe(175_000);
    expect(pickPricingTier(category("truck"), 5000)?.fenPerTon).toBe(185_000);
    expect(pickPricingTier(category("truck"), 8000)?.fenPerTon).toBe(195_000);
    expect(pickPricingTier(category("truck"), 12000)?.fenPerTon).toBe(205_000);
  });
});

describe("定价 · 车值", () => {
  it("按吨价 × 整备质量计算车值", () => {
    const quote = quoteWith(SEDAN);
    expect(quote.category).toBe("sedan_suv");
    expect(quote.fenPerTon).toBe(330_000);
    expect(quote.baseValueFen).toBe(396_000);
    expect(quote.vehicleSubtotalFen).toBe(396_000);
  });

  it("铁轮毂只对小型车每吨减 400 元，并单列 A 区调整", () => {
    const steel = quoteWith({ ...SEDAN, weightKg: 1320 }, { wheelType: "steel", partsConfirmed: true });
    expect(steel.fenPerTon).toBe(330_000);
    expect(steel.baseValueFen).toBe(435_600);
    expect(steel.steelRimApplied).toBe(true);
    expect(steel.steelRimAdjustmentFen).toBe(52_800);
    expect(steel.vehicleSubtotalFen).toBe(382_800);

    const truck = quoteWith(
      { ...SEDAN, vehicleClass: "truck", vehicleType: "重型货车", weightKg: 5000 },
      { wheelType: "steel", partsConfirmed: true },
    );
    expect(truck.steelRimApplied).toBe(false);
    expect(truck.steelRimAdjustmentFen).toBe(0);
    expect(truck.fenPerTon).toBe(185_000);
  });
});

describe("定价 · 扣减", () => {
  it("缺件按目录逐项扣减，大车电瓶不作用于小车", () => {
    const quote = quoteWith(SEDAN, {
      partsConfirmed: true,
      missingParts: { spare_tire: 1, alloy_rim: 1, battery_large: 1 },
    });
    expect(quote.knownDeductionsFen).toBe(17_000);
    expect(quote.netFen).toBe(379_000);
    expect(quote.deductionLines.filter((line) => line.kind === "missing")).toHaveLength(2);
    expect(quote.deductionLines.some((line) => line.code === "battery_large")).toBe(false);
  });

  it("拖车 80 公里内免费，超出部分 5 元/公里", () => {
    const free = quoteWith(SEDAN, {
      partsConfirmed: true,
      distanceKm: 80,
    });
    expect(free.knownDeductionsFen).toBe(0);
    expect(free.deductionLines.find((line) => line.kind === "tow")?.amountFen).toBe(0);

    const far = quoteWith(SEDAN, {
      partsConfirmed: true,
      distanceKm: 150,
    });
    expect(far.deductionLines.find((line) => line.kind === "tow")?.amountFen).toBe(35_000);
    expect(far.knownDeductionsFen).toBe(35_000);

    const self = quoteWith(SEDAN, {
      partsConfirmed: true,
      towMode: "self",
      distanceKm: 200,
    });
    expect(self.knownDeductionsFen).toBe(0);
  });

  it("服务费默认 0，并从配置读取", () => {
    const quote = quoteWith(SEDAN, { partsConfirmed: true });
    expect(quote.deductionLines.find((line) => line.kind === "service")?.amountFen).toBe(0);
    expect(DEFAULT_PRICING.serviceFeeFen).toBe(0);
  });
});

describe("定价 · 区间", () => {
  it("未核对缺件时低价端预留，确认齐全后不再预留", () => {
    const unconfirmed = quoteWith(SEDAN);
    expect(unconfirmed.reservedMissingFen).toBe(30_000);
    expect(unconfirmed.range).toEqual({
      lowFen: 346_000,
      midFen: 396_000,
      highFen: 404_000,
    });
    expect(unconfirmed.unresolved).toContain("缺件未核对");

    const confirmed = quoteWith(SEDAN, { partsConfirmed: true });
    expect(confirmed.reservedMissingFen).toBe(0);
    expect(confirmed.range?.lowFen).toBe(376_000);
    expect(confirmed.range?.midFen).toBe(396_000);
    expect(confirmed.range?.highFen).toBe(404_000);
  });

  it("整备质量缺失时按车型预估重量给区间，并标明预估", () => {
    const quote = quoteWith(
      { ...SEDAN, weightKg: null, weightSource: "missing" },
      { partsConfirmed: true },
    );
    expect(quote.weightSource).toBe("estimated");
    expect(quote.weightKg).toBe(1500);
    expect(quote.weightRangeKg).toEqual({ minKg: 1200, maxKg: 2000 });
    expect(quote.baseValueFen).not.toBeNull();
    expect(quote.netFen).not.toBeNull();
    expect(quote.range).not.toBeNull();
    expect(quote.range!.lowFen).toBeLessThan(quote.range!.midFen);
    expect(quote.range!.highFen).toBeGreaterThan(quote.range!.midFen);
    expect(quote.unresolved.join("；")).toContain("整备质量按");
  });

  it("按辆计价不需要整备质量", () => {
    const moto = quoteWith(
      {
        ...SEDAN,
        vehicleClass: "other",
        vehicleType: "普通二轮摩托车",
        weightKg: null,
        weightSource: "missing",
      },
      { partsConfirmed: true },
    );
    expect(moto.category).toBe("motorcycle");
    expect(moto.netFen).toBe(0);
    expect(moto.range).toEqual({ lowFen: 0, midFen: 0, highFen: 0 });

    const trike = quoteWith(
      {
        ...SEDAN,
        vehicleClass: "other",
        vehicleType: "火三轮",
        weightKg: null,
        weightSource: "missing",
      },
      { partsConfirmed: true },
    );
    expect(trike.netFen).toBe(50_000);
  });
});

describe("定价 · 电动 / 混动", () => {
  it("仍按整车吨价估算，不恢复旧动力电池价值和 4200 元上限", () => {
    const quote = quoteWith(
      { ...SEDAN, weightKg: 1800, energyType: "electric", fuelType: "纯电动" },
      { partsConfirmed: true },
    );
    expect(quote.fenPerTon).toBe(360_000);
    expect(quote.baseValueFen).toBe(648_000);
    expect(quote.netFen).toBe(648_000);
    expect(quote.netFen).toBeGreaterThan(420_000);
    expect(quote.unresolved).toContain("动力电池需现场检测，当前按整车吨价估算");
  });
});

describe("定价 · 行情联动", () => {
  it("默认 0 时不改变吨价与净额", () => {
    expect(DEFAULT_PRICING.marketAdjustmentPct).toBe(0);
    const quote = quoteWith(SEDAN, { partsConfirmed: true });
    expect(quote.fenPerTon).toBe(330_000);
    expect(quote.netFen).toBe(396_000);
  });

  it("+10% 上调吨价与净额，但不改变档位选择", () => {
    const base = quoteWith(SEDAN, { partsConfirmed: true });
    const quote = computeQuote({
      vehicle: SEDAN,
      pricing: { ...DEFAULT_PRICING, marketAdjustmentPct: 10 },
      options: { ...DEFAULT_QUOTE_OPTIONS, missingParts: {}, partsConfirmed: true },
    });
    expect(quote.category).toBe(base.category);
    expect(quote.fenPerTon).toBe(363_000);
    expect(quote.netFen).toBe(436_000);
    expect(quote.netFen).toBeGreaterThan(base.netFen ?? 0);
    expect(quote.assumptions.join("")).toContain("行情联动 +10% 已计入吨价。");
  });

  it("校验拒绝超出 -50%–50% 的联动系数", () => {
    const result = validatePricingConfig({
      ...DEFAULT_PRICING,
      marketAdjustmentPct: 60,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join("")).toContain("行情联动必须在 -50%–50% 之间");
    }
  });
});

describe("定价 · 配置校验", () => {
  it("默认价目表通过校验", () => {
    const result = validatePricingConfig(DEFAULT_PRICING);
    expect(result.ok).toBe(true);
  });

  it("缺少车型档位、档位乱序、缺件编码重复都会报错", () => {
    const missingCategory = {
      ...DEFAULT_PRICING,
      categories: DEFAULT_PRICING.categories.filter((item) => item.code !== "truck"),
    };
    const missingResult = validatePricingConfig(missingCategory);
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.errors.join("")).toContain("缺少车型档位：货车");
    }

    const badOrder = {
      ...DEFAULT_PRICING,
      categories: DEFAULT_PRICING.categories.map((item) =>
        item.code === "sedan_suv"
          ? {
              ...item,
              tiers: [
                { maxKg: 1400, fenPerTon: 330_000 },
                { maxKg: 1000, fenPerTon: 300_000 },
              ],
            }
          : item,
      ),
    };
    const orderResult = validatePricingConfig(badOrder);
    expect(orderResult.ok).toBe(false);
    if (!orderResult.ok) {
      expect(orderResult.errors.join("")).toContain("严格递增");
    }

    const duplicateDeduction = {
      ...DEFAULT_PRICING,
      deductions: [
        ...DEFAULT_PRICING.deductions,
        { ...DEFAULT_PRICING.deductions[0] },
      ],
    };
    const deductionResult = validatePricingConfig(duplicateDeduction);
    expect(deductionResult.ok).toBe(false);
    if (!deductionResult.ok) {
      expect(deductionResult.errors.join("")).toContain("缺件编码重复");
    }
  });
});