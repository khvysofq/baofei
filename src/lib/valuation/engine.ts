/**
 * 报废残值评估 · 演示规则引擎
 *
 * 说明：
 * - VIN 模式：若渠道返回了真实车型档案（`spec`），用实车参数（整备质量/排量/排放/车价/车身形式）参与计价；
 *   查不到渠道时降级为演示推定（WMI + 年款位），并在报告里标明数据来源。
 * - 上传模式：证件字段来自内置演示车型，上传文件只用于生成稳定的评估编号与车况系数。
 * 服务端不保存原图与 VIN 明文以外的内容。
 */

import {
  normalizeVin,
  isValidVin,
  vinYearFromVin,
  vehicleTypeLabel,
} from "@/lib/vin/normalize";
import type { EnergyType, VehicleClass, VinVehicleSpec } from "@/lib/vin/types";

export { isValidVin, normalizeVin };

export type VehicleProfile = {
  plate: string | null;
  vehicleType: string;
  useNature: string;
  brandModel: string;
  vin: string;
  engineNo: string | null;
  registerDate: string | null;
  issueDate: string | null;
  registerNote?: string;
  curbWeightKg: number;
  displacementMl: number;
  fuel: string;
  emission: string;
};

export type ValuationItem = {
  key: string;
  label: string;
  basis: string;
  amountFen: number;
};

export type DeductionItem = {
  label: string;
  basis: string;
  amountFen: number;
};

export type PriceFactor = {
  label: string;
  detail: string;
  tone: "up" | "down" | "flat";
};

export type ValuationSource = "vin" | "license";

/**
 * 车辆身份数据来源。
 * - provider：真实 VIN 渠道返回的车型档案
 * - demo：演示规则推定（未配置渠道、渠道无结果或故障时降级）
 * - license：上传行驶证（样例 OCR）
 */
export type ValuationDataSource = {
  kind: "provider" | "demo" | "license";
  providerId: string | null;
  providerLabel: string | null;
  cached: boolean;
  /** 车型档案的获取时间（缓存命中时为原始获取时间） */
  fetchedAt: string | null;
  missingFields: string[];
  /** 降级原因：用户可见的提示文案 */
  notice: string | null;
};

export type ValuationReport = {
  reportNo: string;
  assessedAt: string;
  validUntil: string;
  source: ValuationSource;
  dataSource: ValuationDataSource;
  profile: VehicleProfile;
  ageYears: number;
  condition: string;
  conditionFactor: number;
  conditionAdjustmentFen: number;
  items: ValuationItem[];
  grossFen: number;
  deductions: DeductionItem[];
  deductionsFen: number;
  netLowFen: number;
  netMidFen: number;
  netHighFen: number;
  confidence: { level: string; note: string };
  factors: PriceFactor[];
  suggestions: string[];
  estimatedFields: string[];
  mode: "demo";
};

type Preset = {
  id: string;
  profile: VehicleProfile;
  steelRatio: number;
  scrapPricePerTonFen: number;
  nonFerrousKg: number;
  nonFerrousPricePerKgFen: number;
  catalystFen: number;
  catalystNote: string;
  batteryFen: number;
  batteryNote: string;
  wheelsFen: number;
  miscFen: number;
  dismantleFen: number;
  towingFen: number;
};

const PRESETS: Preset[] = [
  {
    id: "sedan-2012",
    profile: {
      plate: "川A·8K3L9",
      vehicleType: "小型轿车",
      useNature: "非营运",
      brandModel: "大众牌 FV7160",
      vin: "LSVAA49J5C2345678",
      engineNo: "CDF****736",
      registerDate: "2012-06-18",
      issueDate: "2012-06-21",
      curbWeightKg: 1320,
      displacementMl: 1598,
      fuel: "汽油",
      emission: "国 IV",
    },
    steelRatio: 0.72,
    scrapPricePerTonFen: 235000,
    nonFerrousKg: 45,
    nonFerrousPricePerKgFen: 1300,
    catalystFen: 62000,
    catalystNote: "原装三元催化 · 含铂钯铑",
    batteryFen: 14000,
    batteryNote: "12V 铅酸蓄电池 1 只",
    wheelsFen: 36000,
    miscFen: 18000,
    dismantleFen: 38000,
    towingFen: 26000,
  },
  {
    id: "mpv-2015",
    profile: {
      plate: "川B·5T2M7",
      vehicleType: "小型普通客车",
      useNature: "非营运",
      brandModel: "五菱牌 LZW6442",
      vin: "LZWADAGA3F8123456",
      engineNo: "LMU****214",
      registerDate: "2015-03-09",
      issueDate: "2015-03-12",
      curbWeightKg: 1185,
      displacementMl: 1485,
      fuel: "汽油",
      emission: "国 V",
    },
    steelRatio: 0.7,
    scrapPricePerTonFen: 235000,
    nonFerrousKg: 38,
    nonFerrousPricePerKgFen: 1300,
    catalystFen: 48000,
    catalystNote: "原装三元催化 · 小排量",
    batteryFen: 14000,
    batteryNote: "12V 铅酸蓄电池 1 只",
    wheelsFen: 32000,
    miscFen: 16000,
    dismantleFen: 38000,
    towingFen: 24000,
  },
  {
    id: "van-2011",
    profile: {
      plate: "川A·3F7Q2",
      vehicleType: "轻型厢式货车",
      useNature: "营运",
      brandModel: "东风牌 EQ5041",
      vin: "LGDCH81G8B1234567",
      engineNo: "4JB1****908",
      registerDate: "2011-11-22",
      issueDate: "2011-11-25",
      curbWeightKg: 2450,
      displacementMl: 2771,
      fuel: "柴油",
      emission: "国 III",
    },
    steelRatio: 0.78,
    scrapPricePerTonFen: 230000,
    nonFerrousKg: 70,
    nonFerrousPricePerKgFen: 1200,
    catalystFen: 26000,
    catalystNote: "柴油 DOC 载体 · 残值有限",
    batteryFen: 22000,
    batteryNote: "12V 铅酸蓄电池 2 只",
    wheelsFen: 48000,
    miscFen: 24000,
    dismantleFen: 68000,
    towingFen: 42000,
  },
];

const CONDITION_TIERS = [
  { label: "良好", factor: 1.04, note: "外观完整、主要总成齐全" },
  { label: "一般", factor: 1.0, note: "正常使用痕迹，未见明显缺件" },
  { label: "需现场核验", factor: 0.94, note: "存在锈蚀或部件缺失可能" },
];

/** WMI → 品牌与车型类别（演示用，不追求与真实车型库一致）。 */
const WMI_MAP: Record<string, { brand: string; model: string; preset: number }> = {
  LSV: { brand: "大众牌", model: "FV7160", preset: 0 },
  LFV: { brand: "一汽-大众", model: "FV7160", preset: 0 },
  LZW: { brand: "五菱牌", model: "LZW6442", preset: 1 },
  LGD: { brand: "东风牌", model: "EQ5041", preset: 2 },
  LHG: { brand: "本田牌", model: "HG7150", preset: 0 },
  LGB: { brand: "日产牌", model: "DFL7160", preset: 0 },
  LSG: { brand: "别克牌", model: "SGM7160", preset: 0 },
};

export type VinDecode = {
  brand: string;
  model: string;
  vehicleType: string;
  year: number;
  presetIndex: number;
};

export function decodeVin(input: string): VinDecode {
  const vin = normalizeVin(input);
  if (!isValidVin(vin)) throw new Error("VIN 格式不正确");

  const wmi = WMI_MAP[vin.slice(0, 3)];
  const presetIndex =
    wmi?.preset ?? hashByte(createSeed(vin), 0) % PRESETS.length;
  const preset = PRESETS[presetIndex];

  return {
    brand: wmi?.brand ?? preset.profile.brandModel.split(" ")[0],
    model: wmi?.model ?? preset.profile.brandModel.split(" ")[1] ?? "未知车型",
    vehicleType: preset.profile.vehicleType,
    year: vinYearFromVin(vin) ?? 2012,
    presetIndex,
  };
}

function createSeed(input: string): string {
  // 仅用于演示取模；不承担密码学用途。
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
}

function roundToYuan(fen: number, unitYuan = 10): number {
  const unit = unitYuan * 100;
  return Math.round(fen / unit) * unit;
}

function hashByte(seed: string, offset: number): number {
  return parseInt(seed.slice(offset * 2, offset * 2 + 2) || "0", 16);
}

function yearsSince(date: string, now: Date): number {
  const start = new Date(`${date}T00:00:00Z`).getTime();
  const years = (now.getTime() - start) / (365.2425 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(years * 10) / 10);
}

type ScrapBasis = {
  steelRatio: number;
  scrapPricePerTonFen: number;
  nonFerrousKg: number;
  nonFerrousPricePerKgFen: number;
  catalystFen: number;
  catalystNote: string;
  batteryFen: number;
  batteryNote: string;
  wheelsFen: number;
  miscFen: number;
  dismantleFen: number;
  towingFen: number;
  /** 可回用件（三元催化/轮毂/其他件）修正系数：车价越高、车龄越短，残值越高 */
  reuseFactor: number;
};

type ClassCoefficient = {
  steelRatio: number;
  wheelsFen: number;
  miscFen: number;
  dismantleFen: number;
  towingFen: number;
  fallbackWeightKg: number;
  fallbackDisplacementMl: number;
};

/** 按车身形式给的拆解系数；整备质量仍以渠道返回的实车数据为准。 */
const CLASS_COEFFICIENTS: Record<VehicleClass, ClassCoefficient> = {
  sedan: {
    steelRatio: 0.7,
    wheelsFen: 36000,
    miscFen: 18000,
    dismantleFen: 38000,
    towingFen: 26000,
    fallbackWeightKg: 1400,
    fallbackDisplacementMl: 1600,
  },
  suv: {
    steelRatio: 0.72,
    wheelsFen: 40000,
    miscFen: 20000,
    dismantleFen: 40000,
    towingFen: 28000,
    fallbackWeightKg: 1700,
    fallbackDisplacementMl: 2000,
  },
  mpv: {
    steelRatio: 0.72,
    wheelsFen: 36000,
    miscFen: 18000,
    dismantleFen: 38000,
    towingFen: 28000,
    fallbackWeightKg: 1720,
    fallbackDisplacementMl: 1800,
  },
  van: {
    steelRatio: 0.78,
    wheelsFen: 32000,
    miscFen: 16000,
    dismantleFen: 68000,
    towingFen: 42000,
    fallbackWeightKg: 2200,
    fallbackDisplacementMl: 2000,
  },
  pickup: {
    steelRatio: 0.76,
    wheelsFen: 48000,
    miscFen: 24000,
    dismantleFen: 46000,
    towingFen: 32000,
    fallbackWeightKg: 1900,
    fallbackDisplacementMl: 2400,
  },
  truck: {
    steelRatio: 0.8,
    wheelsFen: 48000,
    miscFen: 24000,
    dismantleFen: 68000,
    towingFen: 42000,
    fallbackWeightKg: 2800,
    fallbackDisplacementMl: 2800,
  },
  bus: {
    steelRatio: 0.74,
    wheelsFen: 60000,
    miscFen: 32000,
    dismantleFen: 88000,
    towingFen: 52000,
    fallbackWeightKg: 5200,
    fallbackDisplacementMl: 4000,
  },
  other: {
    steelRatio: 0.72,
    wheelsFen: 36000,
    miscFen: 18000,
    dismantleFen: 38000,
    towingFen: 26000,
    fallbackWeightKg: 1450,
    fallbackDisplacementMl: 1600,
  },
};

const SCRAP_PRICE_PER_TON_FEN = 235000;
const NONFERROUS_PRICE_PER_KG_FEN = 1300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function presetBasis(preset: Preset): ScrapBasis {
  return {
    steelRatio: preset.steelRatio,
    scrapPricePerTonFen: preset.scrapPricePerTonFen,
    nonFerrousKg: preset.nonFerrousKg,
    nonFerrousPricePerKgFen: preset.nonFerrousPricePerKgFen,
    catalystFen: preset.catalystFen,
    catalystNote: preset.catalystNote,
    batteryFen: preset.batteryFen,
    batteryNote: preset.batteryNote,
    wheelsFen: preset.wheelsFen,
    miscFen: preset.miscFen,
    dismantleFen: preset.dismantleFen,
    towingFen: preset.towingFen,
    reuseFactor: 1,
  };
}

function catalystByFuel(
  energy: EnergyType,
  displacementMl: number | null,
): { fen: number; note: string } {
  if (energy === "electric") {
    return { fen: 0, note: "纯电车型无三元催化" };
  }
  if (energy === "diesel") {
    return { fen: 26000, note: "柴油 DOC 载体 · 残值有限" };
  }
  if (energy === "hybrid") {
    return { fen: 56000, note: "混动车型 · 按汽油机催化器计" };
  }
  const displacement = displacementMl ?? 0;
  if (energy === "gasoline") {
    if (displacement > 0 && displacement < 1500) {
      return { fen: 48000, note: "原装三元催化 · 小排量" };
    }
    if (displacement > 0 && displacement < 2100) {
      return { fen: 62000, note: "原装三元催化 · 含铂钯铑" };
    }
    if (displacement > 0 && displacement < 3000) {
      return { fen: 88000, note: "原装三元催化 · 中大排量" };
    }
    return { fen: 120000, note: "原装三元催化 · 大排量" };
  }
  return { fen: 45000, note: "燃料类型未知 · 按通用催化器残值估算" };
}

function batteryByFuel(
  energy: EnergyType,
  newCarPriceFen: number | null,
): { fen: number; note: string } {
  if (energy === "electric") {
    const estimated = newCarPriceFen === null ? 12000 : Math.round(newCarPriceFen * 0.06);
    return {
      fen: clamp(estimated, 8000, 420000),
      note: "动力电池按容量与健康度评估，需现场检测",
    };
  }
  if (energy === "hybrid") {
    return { fen: 16000, note: "12V 辅助电池 · 高压电池组按梯次利用另计" };
  }
  if (energy === "diesel") {
    return { fen: 22000, note: "柴油车 12V 铅酸蓄电池 2 只" };
  }
  return { fen: 14000, note: "12V 铅酸蓄电池 1 只" };
}

/** 新车指导价与车龄共同决定可回用件溢价，区间收在 0.78–1.25，避免离谱。 */
function reuseFactor(priceFen: number | null, ageYears: number): number {
  let priceFactor = 1;
  if (priceFen !== null) {
    const wan = priceFen / 1_000_000;
    if (wan < 8) priceFactor = 0.95;
    else if (wan < 15) priceFactor = 1;
    else if (wan < 25) priceFactor = 1.06;
    else if (wan < 40) priceFactor = 1.12;
    else priceFactor = 1.18;
  }
  const ageFactor =
    ageYears <= 8 ? 1.05 : ageYears <= 12 ? 1 : ageYears <= 15 ? 0.92 : 0.85;
  return clamp(priceFactor * ageFactor, 0.78, 1.25);
}

function basisFromSpec(
  spec: VinVehicleSpec,
  options: { weightKg: number; displacementMl: number; ageYears: number },
): ScrapBasis {
  const coefficients = CLASS_COEFFICIENTS[spec.vehicleClass];
  const heavyFactor =
    spec.vehicleClass === "truck" ? 1.15 : spec.vehicleClass === "bus" ? 1.1 : 1;
  const nonFerrousKg = Math.round(
    clamp(options.weightKg * 0.03 * heavyFactor, 15, 120),
  );
  const catalyst = catalystByFuel(spec.energyType, options.displacementMl);
  const battery = batteryByFuel(spec.energyType, spec.newCarPriceFen);
  const dismantleExtra = spec.energyType === "electric" ? 14000 : 0;

  return {
    steelRatio: coefficients.steelRatio,
    scrapPricePerTonFen: SCRAP_PRICE_PER_TON_FEN,
    nonFerrousKg,
    nonFerrousPricePerKgFen: NONFERROUS_PRICE_PER_KG_FEN,
    catalystFen: catalyst.fen,
    catalystNote: catalyst.note,
    batteryFen: battery.fen,
    batteryNote: battery.note,
    wheelsFen: coefficients.wheelsFen,
    miscFen: coefficients.miscFen,
    dismantleFen: coefficients.dismantleFen + dismantleExtra,
    towingFen: coefficients.towingFen,
    reuseFactor: reuseFactor(spec.newCarPriceFen, options.ageYears),
  };
}

function formatWan(priceFen: number | null): string | null {
  if (priceFen === null) return null;
  return `${(priceFen / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} 万`;
}

function buildProfileFromSpec(
  spec: VinVehicleSpec,
  vin: string,
  resolved: { weightKg: number; displacementMl: number; modelYear: number | null },
): VehicleProfile {
  const brandText = spec.brand ?? spec.manufacturer ?? "";
  const modelText = spec.modelName ?? spec.seriesName ?? "";
  const brandModel =
    modelText && brandText && modelText.startsWith(brandText)
      ? modelText
      : [brandText, modelText].filter(Boolean).join(" ") || "未知车型";

  return {
    plate: null,
    vehicleType: vehicleTypeLabel(spec.vehicleClass, {
      isCommercial: spec.isCommercial,
      weightKg: resolved.weightKg,
      seats: spec.seats,
    }),
    useNature: spec.isCommercial === true ? "营运" : "非营运",
    brandModel,
    vin,
    engineNo: null,
    registerDate: null,
    issueDate: null,
    registerNote:
      resolved.modelYear === null
        ? "年款未知（以行驶证为准）"
        : `${resolved.modelYear} 年款（VIN 解析）`,
    curbWeightKg: resolved.weightKg,
    displacementMl: resolved.displacementMl,
    fuel: spec.fuelType ?? "未知",
    emission: spec.emissionStandard ?? "未知",
  };
}

export function buildValuationReport(options: {
  seed: string;
  source?: ValuationSource;
  vin?: string;
  sample?: boolean;
  now?: Date;
  /** 真实 VIN 渠道返回的车型档案；为空则走演示推定 */
  spec?: VinVehicleSpec | null;
  /** 降级原因提示（渠道不可用等），透传到报告 */
  notice?: string | null;
}): ValuationReport {
  const now = options.now ?? new Date();
  const source: ValuationSource = options.source ?? (options.vin ? "vin" : "license");
  const vinMode = source === "vin";
  const vin = vinMode
    ? normalizeVin(options.vin ?? "")
    : options.sample
      ? PRESETS[0].profile.vin
      : "";
  const spec = vinMode ? options.spec ?? null : null;
  const decoded = vinMode && !spec ? decodeVin(vin) : null;

  const preset = vinMode
    ? PRESETS[decoded?.presetIndex ?? 0]
    : options.sample
      ? PRESETS[0]
      : PRESETS[hashByte(options.seed, 0) % PRESETS.length];

  // 真实车型档案不编造车况，按“正常使用痕迹”中性计；演示路径沿用原有确定性分档。
  const tier =
    spec !== null
      ? { label: "一般", factor: 1, note: "车况未实地核验，按正常使用痕迹计" }
      : CONDITION_TIERS[
          options.sample ? 0 : hashByte(options.seed, 1) % CONDITION_TIERS.length
        ];

  const modelYear = spec ? spec.modelYear ?? spec.vinYear : decoded?.year ?? null;

  const coefficients = CLASS_COEFFICIENTS[spec?.vehicleClass ?? "other"];
  const weightEstimated = spec !== null && spec.curbWeightKg === null;
  const displacementEstimated = spec !== null && spec.displacementMl === null;
  const weightKg = spec
    ? spec.curbWeightKg ?? coefficients.fallbackWeightKg
    : preset.profile.curbWeightKg;
  const displacementMl = spec
    ? spec.displacementMl ?? coefficients.fallbackDisplacementMl
    : preset.profile.displacementMl;

  const profile: VehicleProfile = spec
    ? buildProfileFromSpec(spec, vin, { weightKg, displacementMl, modelYear })
    : vinMode
      ? {
          ...preset.profile,
          plate: null,
          vin,
          engineNo: null,
          registerDate: null,
          issueDate: null,
          registerNote: `${decoded!.year} 年款（VIN 推定）`,
          brandModel: `${decoded!.brand} ${decoded!.model}`,
        }
      : { ...preset.profile, vin: preset.profile.vin };

  const ageYears = vinMode
    ? Math.max(
        0,
        Math.round(
          ((now.getTime() - new Date(`${modelYear ?? 2012}-07-01T00:00:00Z`).getTime()) /
            (365.2425 * 24 * 60 * 60 * 1000)) *
            10,
        ) / 10,
      )
    : yearsSince(profile.registerDate ?? preset.profile.registerDate ?? "2012-01-01", now);

  const basis: ScrapBasis = spec
    ? basisFromSpec(spec, { weightKg, displacementMl, ageYears })
    : presetBasis(preset);

  const steelFen = roundToYuan(
    weightKg * basis.steelRatio * (basis.scrapPricePerTonFen / 1000),
  );
  const nonFerrousFen = roundToYuan(
    basis.nonFerrousKg * basis.nonFerrousPricePerKgFen,
  );
  const catalystFen = roundToYuan(basis.catalystFen * basis.reuseFactor);
  const wheelsFen = roundToYuan(basis.wheelsFen * basis.reuseFactor);
  const miscFen = roundToYuan(basis.miscFen * basis.reuseFactor);
  const weightSource = spec
    ? weightEstimated
      ? "同平台推定"
      : "VIN 解析"
    : "同平台推定";
  const reuseSuffix =
    basis.reuseFactor === 1
      ? ""
      : ` · 可回用件系数 ${basis.reuseFactor.toFixed(2)}（车价/车龄）`;

  const items: ValuationItem[] = [
    {
      key: "steel",
      label: "废钢残值",
      basis: `整备质量 ${weightKg}kg（${weightSource}） × 可回收金属 ${Math.round(
        basis.steelRatio * 100,
      )}% × ${(basis.scrapPricePerTonFen / 100000).toFixed(2)} 元/kg`,
      amountFen: steelFen,
    },
    {
      key: "nonferrous",
      label: "有色金属",
      basis: `铝制件与铜线束约 ${basis.nonFerrousKg}kg × ${(
        basis.nonFerrousPricePerKgFen / 100
      ).toFixed(0)} 元/kg`,
      amountFen: nonFerrousFen,
    },
    {
      key: "catalyst",
      label: "三元催化器",
      basis: `${basis.catalystNote}${reuseSuffix}`,
      amountFen: catalystFen,
    },
    {
      key: "battery",
      label: spec?.energyType === "electric" ? "动力电池" : "蓄电池",
      basis: basis.batteryNote,
      amountFen: basis.batteryFen,
    },
    {
      key: "wheels",
      label: "轮胎与轮毂",
      basis: `4 套 · 按可回收成色计价${reuseSuffix}`,
      amountFen: wheelsFen,
    },
    {
      key: "misc",
      label: "其他可回收件",
      basis: `起动机、发电机、散热器等${reuseSuffix}`,
      amountFen: miscFen,
    },
  ];

  const grossFen = items.reduce((sum, item) => sum + item.amountFen, 0);

  const deductions: DeductionItem[] = [
    {
      label: "拆解与环保处置",
      basis:
        spec?.energyType === "electric"
          ? "废油液、冷媒、高压电池包安全处置"
          : "废油液、冷媒、破碎分选",
      amountFen: basis.dismantleFen,
    },
    {
      label: "拖运与上门服务",
      basis: "成都绕城内 · 可自行送车减免",
      amountFen: basis.towingFen,
    },
  ];
  const deductionsFen = deductions.reduce((sum, item) => sum + item.amountFen, 0);

  const baseFen = grossFen - deductionsFen;
  const conditionAdjustmentFen = roundToYuan(baseFen * (tier.factor - 1), 1);
  const netMidFen = roundToYuan(baseFen + conditionAdjustmentFen);
  const netLowFen = roundToYuan(netMidFen * 0.94);
  const netHighFen = roundToYuan(netMidFen * 1.08);

  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const priceWan = formatWan(spec?.newCarPriceFen ?? null);

  const factors: PriceFactor[] = [
    {
      label: `车龄 ${ageYears} 年`,
      detail: spec
        ? `按${spec.providerLabel}返回的 ${modelYear ?? "未知"} 年款推算，实际以首次登记日期为准`
        : vinMode
          ? "按 VIN 第 10 位年款推算，实际以首次登记日期为准"
          : "可回用件价值随车龄下降，废钢计价不受影响",
      tone: ageYears >= 12 ? "down" : "flat",
    },
    {
      label: `排放 ${profile.emission}`,
      detail:
        profile.emission === "未知"
          ? "渠道未返回排放标准，以行驶证为准"
          : profile.emission.includes("III")
            ? "四川地区可办理报废，部分回收企业限收"
            : "四川地区可正常办理注销与回收",
      tone: "flat",
    },
    {
      label: "三元催化器",
      detail:
        basis.catalystFen >= 40000
          ? "原装件含贵金属，可单独计价"
          : basis.catalystFen > 0
            ? "载体残值有限，按普通废件计"
            : "纯电车型无三元催化，价值集中在动力电池",
      tone: basis.catalystFen >= 40000 ? "up" : "down",
    },
    {
      label: vinMode ? "使用性质（推定非营运）" : `使用性质 ${profile.useNature}`,
      detail:
        profile.useNature === "非营运"
          ? "通常保养更好，可回用件成色更优"
          : "营运车辆磨损更大，成色折减",
      tone: profile.useNature === "非营运" ? "up" : "down",
    },
    {
      label: `整备质量 ${weightKg}kg`,
      detail: spec
        ? weightEstimated
          ? "渠道未返回整备质量，按车身形式推定，现场称重为准"
          : `${spec.providerLabel}返回的实车整备质量，最终以现场称重为准`
        : "同平台车型推定值，现场称重为准",
      tone: "flat",
    },
    ...(priceWan
      ? [
          {
            label: `新车指导价 ${priceWan}`,
            detail:
              basis.reuseFactor >= 1
                ? "指导价较高，可回用件残值上限更高"
                : "车龄偏长，可回用件按折价计",
            tone: (basis.reuseFactor >= 1 ? "up" : "down") as "up" | "down",
          },
        ]
      : []),
    {
      label: "地区行情 四川·成都",
      detail: "按本地回收企业近期成交区间测算",
      tone: "flat",
    },
  ];

  const estimatedFields = vinMode
    ? Array.from(
        new Set(
          spec
            ? [
                "使用性质",
                "车辆类型",
                "三元催化状态",
                "首次登记日期",
                "车况",
                ...(weightEstimated ? ["整备质量"] : []),
                ...(displacementEstimated ? ["排量"] : []),
                ...spec.missingFields,
              ]
            : ["使用性质", "整备质量", "排量", "排放标准", "三元催化状态"],
        ),
      )
    : [];

  const dataSource: ValuationDataSource = {
    kind: spec ? "provider" : vinMode ? "demo" : "license",
    providerId: spec?.providerId ?? null,
    providerLabel: spec?.providerLabel ?? null,
    cached: spec?.cached ?? false,
    fetchedAt: spec?.fetchedAt ?? null,
    missingFields: spec?.missingFields ?? [],
    notice: options.notice ?? null,
  };

  const confidenceLevel =
    spec !== null
      ? weightEstimated || profile.emission === "未知"
        ? "中"
        : "较高"
      : tier.label === "需现场核验"
        ? "中"
        : "较高";

  const confidenceNote =
    spec !== null
      ? `依据${spec.providerLabel} VIN 解析（${spec.brand ?? "未知品牌"} ${
          spec.seriesName ?? spec.modelName ?? ""
        }）与四川回收行情测算 · ${tier.note}`.replace(/\s+/g, " ")
      : `依据${vinMode ? "VIN 解析与车型系数" : "证件信息与车型系数"}测算 · ${tier.note}`;

  return {
    reportNo: `BF-${stamp}-${options.seed.slice(0, 4).toUpperCase()}`,
    assessedAt: now.toISOString(),
    validUntil,
    source,
    dataSource,
    profile,
    ageYears,
    condition: tier.label,
    conditionFactor: tier.factor,
    conditionAdjustmentFen,
    items,
    grossFen,
    deductions,
    deductionsFen,
    netLowFen,
    netMidFen,
    netHighFen,
    confidence: { level: confidenceLevel, note: confidenceNote },
    factors,
    suggestions: [
      vinMode
        ? "补充行驶证照片可校准首次登记日期、号牌与使用性质，区间会更准。"
        : "交车前清空车内物品，随车带好行驶证、机动车登记证书与号牌。",
      spec?.energyType === "electric"
        ? "动力电池需现场检测容量与健康度，报价可能随检测结果调整。"
        : "三元催化器、蓄电池不要自行拆卖，缺件通常按 10%–15% 扣减。",
      "报告 7 天内有效，最终结算以回收企业现场验车与称重结果为准。",
    ],
    estimatedFields,
    mode: "demo",
  };
}