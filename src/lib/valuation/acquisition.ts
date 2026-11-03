/**
 * 合作方收购价（遂宁怡和 2026-10-06 价目表）
 *
 * 与残值模型的分工：
 * - `engine.ts` 回答「这台车值多少」（废钢价 × 出钢率 + 可回用件，随行情波动）
 * - 本文件回答「回收方按吨能付多少」（价目表分档，到厂口径）
 *
 * 约定：
 * - 金额一律整数分；必要输入未知时返回 null 与原因，不猜、不补 0。
 * - 拖车费不并入收购价：价目表是到厂价，80 公里内免费、超出按 5 元/公里另计。
 */

export const ACQUISITION_PROVIDER = "遂宁怡和";
export const ACQUISITION_VERSION = "2026-10-06";
export const STEEL_RIM_DISCOUNT_FEN_PER_TON = 40_000; // 400 元/吨
export const TOW_FREE_KM = 80;
export const TOW_FEN_PER_KM = 500; // 5 元/公里

export type AcquisitionCategory =
  | "sedan_suv"
  | "van_pickup"
  | "business"
  | "truck"
  | "bus_mid_ac"
  | "bus_mid_no_ac"
  | "bus_large"
  | "tractor"
  | "motorcycle"
  | "tricycle";

export const CATEGORY_LABELS: Record<AcquisitionCategory, string> = {
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

type TonTier = {
  /** 该档上限（含）；null 表示无上限 */
  maxKg: number | null;
  fenPerTon: number;
};

/** 按吨计价的档位表，上限升序排列。 */
const TON_TIERS: Partial<Record<AcquisitionCategory, TonTier[]>> = {
  sedan_suv: [
    { maxKg: 1000, fenPerTon: 300_000 }, // 3000 元/吨 · 1 吨以下
    { maxKg: 1400, fenPerTon: 330_000 }, // 3300 元/吨 · 1.0–1.4 吨
    { maxKg: null, fenPerTon: 360_000 }, // 3600 元/吨 · 超过 1.4 吨（含 BBA）
  ],
  van_pickup: [{ maxKg: null, fenPerTon: 250_000 }],
  business: [{ maxKg: null, fenPerTon: 260_000 }],
  truck: [
    { maxKg: 3000, fenPerTon: 175_000 }, // 1.5–3 吨
    { maxKg: 6000, fenPerTon: 185_000 }, // 3–6 吨
    { maxKg: 10000, fenPerTon: 195_000 }, // 6–10 吨
    { maxKg: null, fenPerTon: 205_000 }, // 10 吨以上
  ],
  bus_mid_ac: [{ maxKg: null, fenPerTon: 225_000 }], // 区间价 2100–2400，取中值
  bus_mid_no_ac: [{ maxKg: null, fenPerTon: 210_000 }],
  bus_large: [{ maxKg: null, fenPerTon: 255_000 }], // 区间价 2100–3000，取中值
  tractor: [{ maxKg: null, fenPerTon: 215_000 }],
};

/** 按辆计价 */
const UNIT_PRICES: Partial<Record<AcquisitionCategory, number>> = {
  motorcycle: 0, // 免费办理手续
  tricycle: 50_000, // 500 元/辆
};

export type DeductionScope = "car" | "truck" | "all";

export type DeductionCatalogItem = {
  code: string;
  name: string;
  unit: string;
  fen: number;
  scope: DeductionScope;
};

/** 缺件扣款目录（价目表原文）。 */
export const DEDUCTION_CATALOG: DeductionCatalogItem[] = [
  { code: "spare_tire", name: "备胎", unit: "个", fen: 5_000, scope: "all" },
  { code: "battery_small", name: "电瓶（小车）", unit: "个", fen: 10_000, scope: "car" },
  { code: "battery_large", name: "电瓶（大车）", unit: "个", fen: 20_000, scope: "truck" },
  { code: "alloy_rim", name: "铝圈", unit: "个", fen: 12_000, scope: "all" },
  { code: "wire_harness", name: "线束", unit: "套", fen: 40_000, scope: "all" },
  { code: "cooler", name: "水箱、冷凝器", unit: "个", fen: 10_000, scope: "all" },
  { code: "starter_group", name: "启动机、发电机、压缩机、ABS", unit: "个", fen: 10_000, scope: "all" },
  { code: "ecu_group", name: "电脑板、控制盒、中控屏、仪表", unit: "个", fen: 6_000, scope: "all" },
];

export type DeductionPick = { code: string; qty: number };

export type AcquisitionLine = {
  label: string;
  detail: string;
  amountFen: number | null;
};

export type AcquisitionQuote = {
  provider: string;
  version: string;
  category: AcquisitionCategory;
  categoryLabel: string;
  pricingMode: "ton" | "unit";
  weightKg: number | null;
  fenPerTon: number | null;
  steelRimDiscount: boolean;
  grossFen: number | null;
  deductionLines: AcquisitionLine[];
  deductionsFen: number;
  netFen: number | null;
  notices: string[];
};

/** 车型文本 + 车辆分类 → 价目表车型。认不出返回 null（不硬猜）。 */
export function resolveCategory(input: {
  vehicleType?: string | null;
  vehicleClass?: string | null;
}): AcquisitionCategory | null {
  const text = (input.vehicleType ?? "").trim();
  const cls = (input.vehicleClass ?? "").trim();

  if (/摩托|三轮摩托|摩托车/.test(text)) return "motorcycle";
  if (/火三轮|三轮汽车|正三轮/.test(text)) return "tricycle";
  if (/牵引|半挂牵引|拖头/.test(text)) return "tractor";
  if (/大型客车|大客车|大型普通客车/.test(text)) return "bus_large";
  if (/中型客车|中型普通客车/.test(text)) {
    if (/空调/.test(text)) return "bus_mid_ac";
    return "bus_mid_no_ac";
  }
  if (/客车/.test(text) && !/小型|微型/.test(text)) return "bus_mid_no_ac";
  if (/皮卡|多用途货车/.test(text)) return "van_pickup";
  if (/货车|卡车|厢式|自卸|载货/.test(text)) return "truck";
  if (/面包车/.test(text)) return "van_pickup";
  if (/商务车|MPV/i.test(text)) return "business";
  if (/轿车|越野|旅行车|小型普通客车|小型客车/.test(text)) return "sedan_suv";

  // 文本认不出时退回渠道给的车身分类
  switch (cls) {
    case "sedan":
    case "suv":
    case "mpv":
      return "sedan_suv";
    case "van":
    case "pickup":
      return "van_pickup";
    case "truck":
      return "truck";
    case "bus":
      return "bus_mid_no_ac";
    default:
      return null;
  }
}

/** 选档：上限升序，命中第一档。 */
export function pickTier(
  category: AcquisitionCategory,
  weightKg: number,
): TonTier | null {
  const tiers = TON_TIERS[category];
  if (!tiers) return null;
  for (const tier of tiers) {
    if (tier.maxKg === null || weightKg <= tier.maxKg) return tier;
  }
  return tiers[tiers.length - 1] ?? null;
}

/** 缺件扣款：只计该车型适用的项，未知编码直接报错（不猜价）。 */
export function calcDeductionsFen(
  picks: DeductionPick[],
  category: AcquisitionCategory,
): { totalFen: number; lines: AcquisitionLine[] } {
  const scope: DeductionScope =
    category === "truck" || category === "bus_mid_ac" || category === "bus_mid_no_ac" || category === "bus_large" || category === "tractor"
      ? "truck"
      : "car";
  const lines: AcquisitionLine[] = [];
  let totalFen = 0;
  for (const pick of picks) {
    if (pick.qty <= 0) continue;
    const item = DEDUCTION_CATALOG.find((c) => c.code === pick.code);
    if (!item) throw new Error(`未知缺件编码：${pick.code}`);
    if (item.scope !== "all" && item.scope !== scope) continue;
    totalFen += item.fen * pick.qty;
    lines.push({
      label: item.name,
      detail: `${pick.qty}${item.unit} × ¥${(item.fen / 100).toFixed(0)}`,
      amountFen: item.fen * pick.qty,
    });
  }
  return { totalFen, lines };
}

/** 拖车费：≤80 公里免费，超出部分 5 元/公里；里程未知返回 null。 */
export function calcTowFen(distanceKm: number | null): number | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  if (distanceKm <= TOW_FREE_KM) return 0;
  return Math.round((distanceKm - TOW_FREE_KM) * TOW_FEN_PER_KM);
}

/**
 * 计算到厂收购价。
 * 铁圈（铁轮毂）缺失：小型车档位吨价每吨减 400 元。
 */
/**
 * @deprecated 历史价目表计算（仍作为默认定价数据的来源参考）。
 * 用户面统一使用 `src/lib/valuation/pricing.ts` 的 `computeQuote`，本文件的分类逻辑不再进入公开报价。
 */
export function quoteAcquisition(input: {
  category: AcquisitionCategory;
  categoryLabel?: string;
  weightKg: number | null;
  steelRims?: boolean;
  deductions?: DeductionPick[];
}): AcquisitionQuote {
  const label = input.categoryLabel ?? CATEGORY_LABELS[input.category];
  const notices: string[] = [];
  const base = {
    provider: ACQUISITION_PROVIDER,
    version: ACQUISITION_VERSION,
    category: input.category,
    categoryLabel: label,
  };

  const unitPrice = UNIT_PRICES[input.category];
  if (unitPrice !== undefined) {
    const deductions = calcDeductionsFen(input.deductions ?? [], input.category);
    if (input.category === "motorcycle") notices.push("摩托车免费办理手续，不另计收购款");
    return {
      ...base,
      pricingMode: "unit",
      weightKg: input.weightKg,
      fenPerTon: null,
      steelRimDiscount: false,
      grossFen: unitPrice,
      deductionLines: deductions.lines,
      deductionsFen: deductions.totalFen,
      netFen: unitPrice - deductions.totalFen,
      notices,
    };
  }

  if (input.weightKg === null || input.weightKg <= 0) {
    return {
      ...base,
      pricingMode: "ton",
      weightKg: input.weightKg,
      fenPerTon: null,
      steelRimDiscount: false,
      grossFen: null,
      deductionLines: [],
      deductionsFen: 0,
      netFen: null,
      notices: [...notices, "缺少整备质量或称重数据，暂不能按吨计价"],
    };
  }

  const tier = pickTier(input.category, input.weightKg);
  if (!tier) {
    return {
      ...base,
      pricingMode: "ton",
      weightKg: input.weightKg,
      fenPerTon: null,
      steelRimDiscount: false,
      grossFen: null,
      deductionLines: [],
      deductionsFen: 0,
      netFen: null,
      notices: [...notices, "该车型没有对应价格档位"],
    };
  }

  const steelRimDiscount = Boolean(input.steelRims) && input.category === "sedan_suv";
  const fenPerTon = steelRimDiscount
    ? Math.max(0, tier.fenPerTon - STEEL_RIM_DISCOUNT_FEN_PER_TON)
    : tier.fenPerTon;

  if (steelRimDiscount) {
    notices.push("铁轮毂（相对铝圈）每吨减 400 元");
  }
  if (input.category === "bus_mid_ac" || input.category === "bus_large") {
    notices.push("价目表为区间价，此处取中值，实际以验车定档为准");
  }

  const grossFen = Math.round((fenPerTon * input.weightKg) / 1000);
  const deductions = calcDeductionsFen(input.deductions ?? [], input.category);

  return {
    ...base,
    pricingMode: "ton",
    weightKg: input.weightKg,
    fenPerTon,
    steelRimDiscount,
    grossFen,
    deductionLines: deductions.lines,
    deductionsFen: deductions.totalFen,
    netFen: grossFen - deductions.totalFen,
    notices,
  };
}