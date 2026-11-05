/**
 * 收购价定价模型（纯函数，可在浏览器与 Node 复用）
 *
 * 口径：回收企业按吨收购的到厂价。
 * - 金额一律整数分，展示时再换算元。
 * - 只凭 VIN 车型档案估算，不含车况、里程、维修记录与证件信息。
 * - 整备质量来自渠道时标记 `vin`，显式推定标记 `estimated`，缺失就 `missing`；
 *   缺失时不给总价，绝不编一个重量去凑数。
 * - 电动 / 混动仍按整车吨价计，动力电池价值不单独计入，待现场检测。
 */

import { formatYuan } from "@/lib/domain/money";
import type { EnergyType, VehicleClass } from "@/lib/vin/types";

export const CATEGORY_CODES = [
  "sedan_suv",
  "van_pickup",
  "business",
  "truck",
  "bus_mid_ac",
  "bus_mid_no_ac",
  "bus_large",
  "tractor",
  "motorcycle",
  "tricycle",
] as const;

export type PricingCategoryCode = (typeof CATEGORY_CODES)[number];

export const CATEGORY_LABELS: Record<PricingCategoryCode, string> = {
  sedan_suv: "小型车（轿车 / 越野车）",
  van_pickup: "面包车 / 皮卡",
  business: "商务车",
  truck: "货车",
  bus_mid_ac: "中型客车（带空调）",
  bus_mid_no_ac: "中型客车（不带空调）",
  bus_large: "大型客车",
  tractor: "牵引拖头",
  motorcycle: "摩托车",
  tricycle: "火三轮",
};

export type PricingTier = {
  /** 该档上限（含）；null 表示无上限。 */
  maxKg: number | null;
  /** 每吨收购价，单位分。 */
  fenPerTon: number;
};

export type PricingCategory = {
  code: PricingCategoryCode;
  label: string;
  mode: "ton" | "unit";
  /** 按吨计价时按 maxKg 升序；按辆计价时为 []。 */
  tiers: PricingTier[];
  /** 按辆计价的固定价（分）；按吨计价时为 null。 */
  unitFen: number | null;
};

export type DeductionScope = "car" | "truck" | "all";

export type DeductionCatalogItem = {
  code: string;
  name: string;
  unit: string;
  /** 单项扣款，单位分。 */
  fen: number;
  scope: DeductionScope;
};

/**
 * 行情参考：供运营判断铜/铁/铝行情时参考，不自动参与计算。
 * 实际调价杠杆是 PricingConfig.marketAdjustmentPct。
 */
export type MarketReference = {
  scrapSteelFenPerTon: number;
  aluminumFenPerTon: number;
  copperFenPerTon: number;
  note: string;
  updatedAt: string;
};

export type PricingConfig = {
  provider: string;
  /** 价目表版本，如 2026-10-06。 */
  rateCardVersion: string;
  categories: PricingCategory[];
  deductions: DeductionCatalogItem[];
  steelRimDiscountFenPerTon: number;
  towFreeKm: number;
  towFenPerKm: number;
  serviceFeeFen: number;
  /** 低价端的重量不确定性百分比。 */
  weightUncertaintyPct: number;
  /** 缺件未核对时低价端预留的扣款（分）。 */
  commonMissingDeductionFen: number;
  /** 高价端的行情上浮百分比。 */
  highBandPct: number;
  /** 行情联动：对全部吨价统一上浮 / 下调的百分比，-50–50。 */
  marketAdjustmentPct: number;
  marketReference: MarketReference;
};

export type WeightSource = "vin" | "estimated" | "missing";

export type VehicleProfile = {
  vin: string;
  brandModel: string;
  /** 展示用车类型，如「小型轿车」；只作展示，不用来定价分类。 */
  vehicleType: string;
  vehicleClass: VehicleClass;
  seats: number | null;
  isCommercial: boolean | null;
  weightKg: number | null;
  weightSource: WeightSource;
  energyType: EnergyType;
  fuelType: string | null;
  displacementMl: number | null;
  modelYear: number | null;
  emission: string | null;
};

export type WheelType = "alloy" | "steel";
export type TowMode = "pickup" | "self";

export type QuoteOptions = {
  wheelType: WheelType;
  towMode: TowMode;
  /** 拖运里程（公里）。0 表示未填写，落在免费里程内。 */
  distanceKm: number;
  /** 缺件编码 → 数量。 */
  missingParts: Record<string, number>;
  /** 是否已确认「主要部件齐全」。未确认时低价端预留缺件扣款。 */
  partsConfirmed: boolean;
};

export type QuoteDeductionLine = {
  kind: "missing" | "tow" | "service" | "reserved";
  code: string | null;
  label: string;
  detail: string;
  /** 扣减金额（分）。reserved 表示低价端预留，不计入已知扣减。 */
  amountFen: number;
  confirmed: boolean;
};

export type QuoteRange = {
  lowFen: number;
  midFen: number;
  highFen: number;
};

export type QuoteResult = {
  category: PricingCategoryCode | null;
  categoryLabel: string;
  pricingMode: "ton" | "unit";
  weightKg: number | null;
  weightSource: WeightSource;
  fenPerTon: number | null;
  /** 铁轮毂前的吨价车值。 */
  baseValueFen: number | null;
  /** 铁轮毂相对铝圈的扣减（正数）。 */
  steelRimAdjustmentFen: number;
  steelRimApplied: boolean;
  /** A 区小计：吨价车值 - 铁轮毂扣减。 */
  vehicleSubtotalFen: number | null;
  deductionLines: QuoteDeductionLine[];
  /** B 区已知扣减合计，不含未核对的预留。 */
  knownDeductionsFen: number;
  /** 缺件未核对时低价端的预留金额。 */
  reservedMissingFen: number;
  /** 中值 / 预计到手。整备质量缺失时为 null。 */
  netFen: number | null;
  range: QuoteRange | null;
  /** 需要现场确认的事项。 */
  unresolved: string[];
  /** 估算假设，3–5 条。 */
  assumptions: string[];
};

export type ValuationDataSource = {
  kind: "provider" | "demo";
  providerId: string | null;
  providerLabel: string | null;
  cached: boolean;
  fetchedAt: string | null;
  notice: string | null;
};

export type VinQuoteReport = {
  vehicle: VehicleProfile;
  pricing: PricingConfig;
  quote: QuoteResult;
  dataSource: ValuationDataSource;
  pricedAt: string;
  pricingVersion: number;
  demo: boolean;
};

const HALF_UNIT_FEN = 1000; // 10 元

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

function isPercent(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 50;
}

function roundToTenYuan(fen: number): number {
  return Math.round(fen / HALF_UNIT_FEN) * HALF_UNIT_FEN;
}

function clampZero(fen: number): number {
  return Math.max(0, fen);
}

function uniquePush(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/** 合作方价目表按车型区分缺件口径：货车 / 客车 / 牵引车按大车，其余按小车。 */
export function deductionScopeFor(category: PricingCategoryCode): DeductionScope {
  switch (category) {
    case "truck":
    case "bus_mid_ac":
    case "bus_mid_no_ac":
    case "bus_large":
    case "tractor":
      return "truck";
    default:
      return "car";
  }
}

export const DEFAULT_PRICING: PricingConfig = {
  provider: "遂宁怡和",
  rateCardVersion: "2026-10-06",
  categories: [
    {
      code: "sedan_suv",
      label: CATEGORY_LABELS.sedan_suv,
      mode: "ton",
      tiers: [
        { maxKg: 1000, fenPerTon: 300_000 },
        { maxKg: 1400, fenPerTon: 330_000 },
        { maxKg: null, fenPerTon: 360_000 },
      ],
      unitFen: null,
    },
    {
      code: "van_pickup",
      label: CATEGORY_LABELS.van_pickup,
      mode: "ton",
      tiers: [{ maxKg: null, fenPerTon: 250_000 }],
      unitFen: null,
    },
    {
      code: "business",
      label: CATEGORY_LABELS.business,
      mode: "ton",
      tiers: [{ maxKg: null, fenPerTon: 260_000 }],
      unitFen: null,
    },
    {
      code: "truck",
      label: CATEGORY_LABELS.truck,
      mode: "ton",
      tiers: [
        { maxKg: 3000, fenPerTon: 175_000 },
        { maxKg: 6000, fenPerTon: 185_000 },
        { maxKg: 10000, fenPerTon: 195_000 },
        { maxKg: null, fenPerTon: 205_000 },
      ],
      unitFen: null,
    },
    {
      code: "bus_mid_ac",
      label: CATEGORY_LABELS.bus_mid_ac,
      mode: "ton",
      tiers: [{ maxKg: null, fenPerTon: 225_000 }],
      unitFen: null,
    },
    {
      code: "bus_mid_no_ac",
      label: CATEGORY_LABELS.bus_mid_no_ac,
      mode: "ton",
      tiers: [{ maxKg: null, fenPerTon: 210_000 }],
      unitFen: null,
    },
    {
      code: "bus_large",
      label: CATEGORY_LABELS.bus_large,
      mode: "ton",
      tiers: [{ maxKg: null, fenPerTon: 255_000 }],
      unitFen: null,
    },
    {
      code: "tractor",
      label: CATEGORY_LABELS.tractor,
      mode: "ton",
      tiers: [{ maxKg: null, fenPerTon: 215_000 }],
      unitFen: null,
    },
    {
      code: "motorcycle",
      label: CATEGORY_LABELS.motorcycle,
      mode: "unit",
      tiers: [],
      unitFen: 0,
    },
    {
      code: "tricycle",
      label: CATEGORY_LABELS.tricycle,
      mode: "unit",
      tiers: [],
      unitFen: 50_000,
    },
  ],
  deductions: [
    { code: "spare_tire", name: "备胎", unit: "个", fen: 5_000, scope: "all" },
    { code: "battery_small", name: "电瓶（小车）", unit: "个", fen: 10_000, scope: "car" },
    { code: "battery_large", name: "电瓶（大车）", unit: "个", fen: 20_000, scope: "truck" },
    { code: "alloy_rim", name: "铝圈", unit: "个", fen: 12_000, scope: "all" },
    { code: "wire_harness", name: "线束", unit: "套", fen: 40_000, scope: "all" },
    { code: "cooler", name: "水箱、冷凝器", unit: "个", fen: 10_000, scope: "all" },
    {
      code: "starter_group",
      name: "启动机、发电机、压缩机、ABS",
      unit: "个",
      fen: 10_000,
      scope: "all",
    },
    {
      code: "ecu_group",
      name: "电脑板、控制盒、中控屏、仪表",
      unit: "个",
      fen: 6_000,
      scope: "all",
    },
  ],
  steelRimDiscountFenPerTon: 40_000,
  towFreeKm: 80,
  towFenPerKm: 500,
  serviceFeeFen: 0,
  weightUncertaintyPct: 5,
  commonMissingDeductionFen: 30_000,
  highBandPct: 2,
  marketAdjustmentPct: 0,
  marketReference: {
    scrapSteelFenPerTon: 235_000,
    aluminumFenPerTon: 1_600_000,
    copperFenPerTon: 7_000_000,
    note: "行情参考仅供运营判断，不自动参与计算；调价请用行情联动系数。",
    updatedAt: "2026-10-06",
  },
};

export const DEFAULT_QUOTE_OPTIONS: QuoteOptions = {
  wheelType: "alloy",
  towMode: "pickup",
  distanceKm: 0,
  missingParts: {},
  partsConfirmed: false,
};

/**
 * 从车辆档案解析价目表车型。
 *
 * 渠道给的车身分类优先，展示用 `vehicleType` 只做兜底：
 * 旧逻辑直接匹配「小型普通客车」，会把 MPV 和非营运面包车误判为小型车。
 */
export function resolvePricingCategory(input: {
  vehicleClass?: VehicleClass | null;
  seats?: number | null;
  isCommercial?: boolean | null;
  weightKg?: number | null;
  vehicleType?: string | null;
  brandModel?: string | null;
}): PricingCategoryCode | null {
  const cls = input.vehicleClass ?? null;
  const seats = input.seats ?? null;
  const weightKg = input.weightKg ?? null;
  const isCommercial = input.isCommercial ?? null;

  if (cls) {
    switch (cls) {
      case "sedan":
      case "suv":
        return "sedan_suv";
      case "mpv":
        return "business";
      case "van":
        return isCommercial === true ? "truck" : "van_pickup";
      case "pickup":
        return "van_pickup";
      case "truck":
        return "truck";
      case "bus": {
        const busText = input.vehicleType ?? "";
        if (seats !== null && seats >= 20) return "bus_large";
        if (/大型客车|大客车|大型普通客车/.test(busText)) return "bus_large";
        if (/中型客车|中型普通客车/.test(busText)) {
          return /空调/.test(busText) ? "bus_mid_ac" : "bus_mid_no_ac";
        }
        return /空调/.test(busText) ? "bus_mid_ac" : "bus_mid_no_ac";
      }
      case "other":
        break;
    }
  }

  const text = `${input.vehicleType ?? ""} ${input.brandModel ?? ""}`.trim();

  if (/摩托|三轮摩托/.test(text)) return "motorcycle";
  if (/火三轮|三轮汽车|正三轮/.test(text)) return "tricycle";
  if (/牵引|半挂牵引|拖头/.test(text)) return "tractor";
  if (/大型客车|大客车|大型普通客车/.test(text)) return "bus_large";
  if (/中型客车|中型普通客车/.test(text)) {
    return /空调/.test(text) ? "bus_mid_ac" : "bus_mid_no_ac";
  }
  if (/客车/.test(text) && !/小型|微型/.test(text)) return "bus_mid_no_ac";
  if (/皮卡|多用途货车/.test(text)) return "van_pickup";
  if (/货车|卡车|厢式|自卸|载货/.test(text)) return "truck";
  if (/面包车|微面/.test(text)) {
    return isCommercial === true ? "truck" : "van_pickup";
  }
  if (/商务车|MPV/i.test(text)) return "business";
  if (/轿车|越野|SUV|旅行车|小型普通客车|小型客车/i.test(text)) {
    return "sedan_suv";
  }

  if (seats !== null && seats >= 20) return "bus_large";
  if (seats !== null && seats >= 9) return "bus_mid_no_ac";
  if (seats !== null && seats >= 7) return "business";
  if (weightKg !== null && weightKg >= 4500) return "truck";

  return null;
}

/** 选档：上限升序，命中第一档；都超过时取最后一档。 */
export function pickPricingTier(
  category: PricingCategory,
  weightKg: number,
): PricingTier | null {
  if (category.mode !== "ton") return null;
  for (const tier of category.tiers) {
    if (tier.maxKg === null || weightKg <= tier.maxKg) return tier;
  }
  return category.tiers[category.tiers.length - 1] ?? null;
}

function sanitizeQty(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function buildDeductionLines(
  pricing: PricingConfig,
  category: PricingCategoryCode | null,
  options: QuoteOptions,
): { lines: QuoteDeductionLine[]; knownFen: number; reservedFen: number; unresolved: string[] } {
  const scope = category ? deductionScopeFor(category) : "all";
  const lines: QuoteDeductionLine[] = [];
  const unresolved: string[] = [];
  let knownFen = 0;

  for (const item of pricing.deductions) {
    const qty = sanitizeQty(options.missingParts[item.code]);
    if (qty <= 0) continue;
    if (item.scope !== "all" && item.scope !== scope) continue;
    const amountFen = item.fen * qty;
    knownFen += amountFen;
    lines.push({
      kind: "missing",
      code: item.code,
      label: item.name,
      detail: `${qty}${item.unit} × ¥${formatYuan(item.fen)}`,
      amountFen,
      confirmed: true,
    });
  }

  const distanceKm = isFiniteNumber(options.distanceKm)
    ? Math.max(0, options.distanceKm)
    : 0;

  if (options.towMode === "self") {
    lines.push({
      kind: "tow",
      code: null,
      label: "拖运费",
      detail: "自行送车，不产生拖运费",
      amountFen: 0,
      confirmed: true,
    });
  } else if (distanceKm <= pricing.towFreeKm) {
    lines.push({
      kind: "tow",
      code: null,
      label: "拖运费",
      detail: `${pricing.towFreeKm} 公里内免费拖车`,
      amountFen: 0,
      confirmed: true,
    });
  } else {
    const extraKm = Math.round((distanceKm - pricing.towFreeKm) * 10) / 10;
    const towFen = Math.round((distanceKm - pricing.towFreeKm) * pricing.towFenPerKm);
    knownFen += towFen;
    lines.push({
      kind: "tow",
      code: null,
      label: "拖运费",
      detail: `超出 ${extraKm} 公里 × ¥${formatYuan(pricing.towFenPerKm)}/公里`,
      amountFen: towFen,
      confirmed: true,
    });
  }

  knownFen += pricing.serviceFeeFen;
  lines.push({
    kind: "service",
    code: null,
    label: "服务费",
    detail: pricing.serviceFeeFen === 0 ? "当前免收" : "按价目表收取",
    amountFen: pricing.serviceFeeFen,
    confirmed: true,
  });

  const reservedFen = options.partsConfirmed
    ? 0
    : Math.max(0, pricing.commonMissingDeductionFen);
  if (!options.partsConfirmed) {
    uniquePush(unresolved, "缺件未核对");
    lines.push({
      kind: "reserved",
      code: null,
      label: "缺件未核对",
      detail:
        reservedFen > 0
          ? `低价端预留 ¥${formatYuan(reservedFen)}，现场核对后多退少补`
          : "待现场核对",
      amountFen: reservedFen,
      confirmed: false,
    });
  }

  return { lines, knownFen, reservedFen, unresolved };
}

/**
 * 计算参考收购价。
 *
 * 区间：
 * - mid  = A 区小计 - 已知扣减
 * - low  = A 区小计 × (1 - 重量不确定性%) - 已知扣减 - 未核对缺件预留
 * - high = A 区小计 × (1 + 行情上浮%) - 已知扣减
 */
export function computeQuote(input: {
  vehicle: VehicleProfile;
  pricing: PricingConfig;
  options?: QuoteOptions;
}): QuoteResult {
  const { vehicle, pricing } = input;
  const options: QuoteOptions = {
    ...DEFAULT_QUOTE_OPTIONS,
    ...input.options,
    missingParts: input.options?.missingParts ?? {},
  };

  const resolved = resolvePricingCategory({
    vehicleClass: vehicle.vehicleClass,
    seats: vehicle.seats,
    isCommercial: vehicle.isCommercial,
    weightKg: vehicle.weightKg,
    vehicleType: vehicle.vehicleType,
    brandModel: vehicle.brandModel,
  });
  const category = resolved
    ? pricing.categories.find((item) => item.code === resolved) ?? null
    : null;

  const weightKg =
    vehicle.weightKg !== null &&
    Number.isFinite(vehicle.weightKg) &&
    vehicle.weightKg > 0
      ? vehicle.weightKg
      : null;
  const weightSource: WeightSource = weightKg === null ? "missing" : vehicle.weightSource;

  const unresolved: string[] = [];
  const assumptions: string[] = [
    "仅凭 VIN 估算，未验车、未称重；最终以现场验车和地磅称重结果为准。",
    "价格按回收企业吨价表计算，区间已包含重量与行情波动。",
  ];
  if (pricing.marketAdjustmentPct !== 0) {
    assumptions.push(
      `行情联动 ${pricing.marketAdjustmentPct > 0 ? "+" : ""}${pricing.marketAdjustmentPct}% 已计入吨价。`,
    );
  }
  assumptions.push(
    "缺件、事故、发动机变速箱拆散等情况会改变结算价，需现场核定。",
  );

  if (vehicle.energyType === "electric" || vehicle.energyType === "hybrid") {
    uniquePush(unresolved, "动力电池需现场检测，当前按整车吨价估算");
    assumptions.push("动力电池需现场检测，当前按整车吨价估算，未单独计入电池价值。");
  }

  const categoryLabel = category?.label ?? "车型未匹配";
  const pricingMode = category?.mode ?? "ton";

  if (!category) {
    uniquePush(unresolved, "车型不在价目表内，需人工核定");
  }

  const deductions = buildDeductionLines(pricing, resolved, options);
  for (const item of deductions.unresolved) uniquePush(unresolved, item);

  let fenPerTon: number | null = null;
  let baseValueFen: number | null = null;
  let steelRimAdjustmentFen = 0;
  let steelRimApplied = false;
  let vehicleSubtotalFen: number | null = null;

  if (category) {
    if (category.mode === "unit") {
      baseValueFen = category.unitFen ?? 0;
      vehicleSubtotalFen = baseValueFen;
    } else if (weightKg === null) {
      uniquePush(unresolved, "整备质量缺失，需地磅称重");
    } else {
      const tier = pickPricingTier(category, weightKg);
      if (!tier) {
        uniquePush(unresolved, "该车型没有对应价格档位");
      } else {
        const effectiveFenPerTon = Math.round(
          tier.fenPerTon * (1 + pricing.marketAdjustmentPct / 100),
        );
        fenPerTon = effectiveFenPerTon;
        baseValueFen = Math.round((effectiveFenPerTon * weightKg) / 1000);
        if (
          options.wheelType === "steel" &&
          category.code === "sedan_suv" &&
          pricing.steelRimDiscountFenPerTon > 0
        ) {
          steelRimApplied = true;
          steelRimAdjustmentFen = Math.min(
            baseValueFen,
            Math.round((pricing.steelRimDiscountFenPerTon * weightKg) / 1000),
          );
          assumptions.push(
            `铁轮毂按每吨减 ¥${formatYuan(pricing.steelRimDiscountFenPerTon)} 计（相对铝圈），现场以实际轮毂材质为准。`,
          );
        }
        vehicleSubtotalFen = baseValueFen - steelRimAdjustmentFen;
      }
    }
  }

  if (weightSource === "estimated") {
    assumptions.push("整备质量使用推定值，未按实车称重。");
  }
  if (options.partsConfirmed) {
    assumptions.push("已确认主要部件齐全，低价端不再预留缺件扣款。");
  }
  if (category?.code === "bus_mid_ac" || category?.code === "bus_large") {
    assumptions.push("客车价目表为区间价，实际以验车定档为准。");
  }

  let netFen: number | null = null;
  let range: QuoteRange | null = null;

  if (vehicleSubtotalFen !== null && category) {
    if (category.mode === "unit") {
      const mid = roundToTenYuan(clampZero(vehicleSubtotalFen - deductions.knownFen));
      const low = roundToTenYuan(
        clampZero(vehicleSubtotalFen - deductions.knownFen - deductions.reservedFen),
      );
      netFen = mid;
      range = {
        lowFen: Math.min(low, mid),
        midFen: mid,
        highFen: mid,
      };
    } else {
      const mid = roundToTenYuan(clampZero(vehicleSubtotalFen - deductions.knownFen));
      const low = roundToTenYuan(
        clampZero(
          vehicleSubtotalFen * (1 - pricing.weightUncertaintyPct / 100) -
            deductions.knownFen -
            deductions.reservedFen,
        ),
      );
      const high = roundToTenYuan(
        clampZero(
          vehicleSubtotalFen * (1 + pricing.highBandPct / 100) - deductions.knownFen,
        ),
      );
      netFen = mid;
      range = {
        lowFen: Math.min(low, mid),
        midFen: mid,
        highFen: Math.max(high, mid),
      };
    }
  }

  return {
    category: category?.code ?? null,
    categoryLabel,
    pricingMode,
    weightKg,
    weightSource,
    fenPerTon,
    baseValueFen,
    steelRimAdjustmentFen,
    steelRimApplied,
    vehicleSubtotalFen,
    deductionLines: deductions.lines,
    knownDeductionsFen: deductions.knownFen,
    reservedMissingFen: deductions.reservedFen,
    netFen,
    range,
    unresolved: [...new Set(unresolved)],
    assumptions: [...new Set(assumptions)].slice(0, 5),
  };
}

export type PricingValidationResult =
  | { ok: true; config: PricingConfig }
  | { ok: false; errors: string[] };

function validateCategory(raw: unknown, index: number, errors: string[]): PricingCategory | null {
  const label = `车型档位 #${index + 1}`;
  if (!isRecord(raw)) {
    errors.push(`${label} 必须是对象`);
    return null;
  }
  const code = raw.code;
  if (typeof code !== "string" || !CATEGORY_CODES.includes(code as PricingCategoryCode)) {
    errors.push(`${label} 的车型编码无效`);
    return null;
  }
  const categoryCode = code as PricingCategoryCode;

  const categoryLabel = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!categoryLabel) errors.push(`${categoryCode} 缺少名称`);

  if (raw.mode !== "ton" && raw.mode !== "unit") {
    errors.push(`${categoryCode} 的计价方式必须是 ton 或 unit`);
    return null;
  }
  const mode = raw.mode;

  if (!Array.isArray(raw.tiers)) {
    errors.push(`${categoryCode} 的档位必须是数组`);
    return null;
  }
  const tiers: PricingTier[] = [];
  let lastMax = 0;
  let sawUnbounded = false;
  raw.tiers.forEach((tierRaw, tierIndex) => {
    if (!isRecord(tierRaw)) {
      errors.push(`${categoryCode} 第 ${tierIndex + 1} 档格式不正确`);
      return;
    }
    const maxKg = tierRaw.maxKg;
    if (maxKg !== null && !(isFiniteNumber(maxKg) && maxKg > 0)) {
      errors.push(`${categoryCode} 第 ${tierIndex + 1} 档上限必须是正数或 null`);
      return;
    }
    if (!isNonNegativeInteger(tierRaw.fenPerTon, 10_000_000)) {
      errors.push(`${categoryCode} 第 ${tierIndex + 1} 档吨价必须在 0–10 万元之间（分）`);
      return;
    }
    if (sawUnbounded) {
      errors.push(`${categoryCode} 的「无上限」档位必须放在最后一档`);
    }
    if (maxKg !== null) {
      if (maxKg <= lastMax) {
        errors.push(`${categoryCode} 的档位上限必须严格递增`);
      }
      lastMax = maxKg;
    } else {
      sawUnbounded = true;
    }
    tiers.push({ maxKg, fenPerTon: tierRaw.fenPerTon });
  });

  if (mode === "ton" && tiers.length === 0) {
    errors.push(`${categoryCode} 至少需要一个吨价档位`);
  }
  if (mode === "unit" && tiers.length > 0) {
    errors.push(`${categoryCode} 按辆计价时不应配置吨价档位`);
  }

  const unitFen = raw.unitFen ?? null;
  if (mode === "unit" && !isNonNegativeInteger(unitFen, 10_000_000)) {
    errors.push(`${categoryCode} 的按辆价格必须在 0–10 万元之间（分）`);
  }
  if (mode === "ton" && unitFen !== null) {
    errors.push(`${categoryCode} 按吨计价时 unitFen 必须为 null`);
  }

  return {
    code: categoryCode,
    label: categoryLabel || CATEGORY_LABELS[categoryCode],
    mode,
    tiers,
    unitFen: mode === "unit" ? (unitFen as number) : null,
  };
}

function validateDeduction(
  raw: unknown,
  index: number,
  errors: string[],
): DeductionCatalogItem | null {
  const label = `缺件 #${index + 1}`;
  if (!isRecord(raw)) {
    errors.push(`${label} 格式不正确`);
    return null;
  }
  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  if (!code) errors.push(`${label} 缺少编码`);
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) errors.push(`${label} 缺少名称`);
  const unit = typeof raw.unit === "string" ? raw.unit.trim() : "";
  if (!unit) errors.push(`${label} 缺少单位`);
  if (!isNonNegativeInteger(raw.fen, 1_000_000)) {
    errors.push(`${label} 的扣款金额必须在 0–1 万元之间（分）`);
  }
  if (raw.scope !== "car" && raw.scope !== "truck" && raw.scope !== "all") {
    errors.push(`${label} 的适用范围无效`);
  }
  if (!code || !name || !unit) return null;
  return {
    code,
    name,
    unit,
    fen: isNonNegativeInteger(raw.fen, 1_000_000) ? raw.fen : 0,
    scope:
      raw.scope === "car" || raw.scope === "truck" || raw.scope === "all"
        ? raw.scope
        : "all",
  };
}

function validateMarketReference(raw: unknown, errors: string[]): MarketReference {
  if (!isRecord(raw)) {
    errors.push("行情参考格式不正确");
    return DEFAULT_PRICING.marketReference;
  }
  const bounds = 100_000_000;
  for (const [key, name] of [
    ["scrapSteelFenPerTon", "废钢"],
    ["aluminumFenPerTon", "铝"],
    ["copperFenPerTon", "铜"],
  ] as const) {
    if (!isNonNegativeInteger(raw[key], bounds)) {
      errors.push(`行情参考中的${name}价格无效`);
    }
  }
  return {
    scrapSteelFenPerTon: isNonNegativeInteger(raw.scrapSteelFenPerTon, bounds)
      ? raw.scrapSteelFenPerTon
      : 0,
    aluminumFenPerTon: isNonNegativeInteger(raw.aluminumFenPerTon, bounds)
      ? raw.aluminumFenPerTon
      : 0,
    copperFenPerTon: isNonNegativeInteger(raw.copperFenPerTon, bounds)
      ? raw.copperFenPerTon
      : 0,
    note: typeof raw.note === "string" ? raw.note : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

/**
 * 校验并归一化定价配置。任何一项不合法都返回全部错误，方便后台一次改完。
 */
export function validatePricingConfig(input: unknown): PricingValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["定价配置必须是对象"] };
  }

  const errors: string[] = [];
  const provider = typeof input.provider === "string" ? input.provider.trim() : "";
  if (!provider) errors.push("缺少回收企业名称");
  const rateCardVersion =
    typeof input.rateCardVersion === "string" ? input.rateCardVersion.trim() : "";
  if (!rateCardVersion) errors.push("缺少价目表版本");

  if (!Array.isArray(input.categories)) {
    errors.push("车型档位必须是数组");
  }
  const categories = Array.isArray(input.categories)
    ? input.categories
        .map((raw, index) => validateCategory(raw, index, errors))
        .filter((item): item is PricingCategory => item !== null)
    : [];

  const seenCodes = new Set<PricingCategoryCode>();
  for (const category of categories) {
    if (seenCodes.has(category.code)) {
      errors.push(`车型编码重复：${category.code}`);
    }
    seenCodes.add(category.code);
  }
  for (const code of CATEGORY_CODES) {
    if (!seenCodes.has(code)) errors.push(`缺少车型档位：${CATEGORY_LABELS[code]}`);
  }

  if (!Array.isArray(input.deductions)) {
    errors.push("缺件扣款目录必须是数组");
  }
  const deductions = Array.isArray(input.deductions)
    ? input.deductions
        .map((raw, index) => validateDeduction(raw, index, errors))
        .filter((item): item is DeductionCatalogItem => item !== null)
    : [];

  const seenDeductionCodes = new Set<string>();
  for (const item of deductions) {
    if (seenDeductionCodes.has(item.code)) {
      errors.push(`缺件编码重复：${item.code}`);
    }
    seenDeductionCodes.add(item.code);
  }
  if (deductions.length === 0) errors.push("缺件扣款目录不能为空");

  const amountFields = [
    ["steelRimDiscountFenPerTon", "铁轮毂每吨扣减", 1_000_000],
    ["serviceFeeFen", "服务费", 1_000_000],
    ["commonMissingDeductionFen", "缺件预留扣款", 1_000_000],
  ] as const;
  for (const [key, name, max] of amountFields) {
    if (!isNonNegativeInteger(input[key], max)) {
      errors.push(`${name}必须是非负整数分（最多 ${max / 100} 元）`);
    }
  }

  if (!isNonNegativeInteger(input.towFreeKm, 10_000)) {
    errors.push("免费拖运里程必须是 0–10000 之间的整数");
  }
  if (!isNonNegativeInteger(input.towFenPerKm, 100_000)) {
    errors.push("拖运单价必须是非负整数分（最多 1000 元/公里）");
  }
  if (!isPercent(input.weightUncertaintyPct)) {
    errors.push("重量不确定性必须在 0–50% 之间");
  }
  if (!isPercent(input.highBandPct)) {
    errors.push("高价上浮必须在 0–50% 之间");
  }
  const marketAdjustmentPct = input.marketAdjustmentPct ?? 0;
  if (
    !isFiniteNumber(marketAdjustmentPct) ||
    marketAdjustmentPct < -50 ||
    marketAdjustmentPct > 50
  ) {
    errors.push("行情联动必须在 -50%–50% 之间");
  }

  const marketReference = validateMarketReference(input.marketReference, errors);

  if (errors.length > 0) return { ok: false, errors };

  const config: PricingConfig = {
    provider,
    rateCardVersion,
    categories: CATEGORY_CODES.map(
      (code) => categories.find((item) => item.code === code)!,
    ),
    deductions,
    steelRimDiscountFenPerTon: input.steelRimDiscountFenPerTon as number,
    towFreeKm: input.towFreeKm as number,
    towFenPerKm: input.towFenPerKm as number,
    serviceFeeFen: input.serviceFeeFen as number,
    weightUncertaintyPct: input.weightUncertaintyPct as number,
    commonMissingDeductionFen: input.commonMissingDeductionFen as number,
    highBandPct: input.highBandPct as number,
    marketAdjustmentPct: marketAdjustmentPct as number,
    marketReference,
  };

  return { ok: true, config };
}