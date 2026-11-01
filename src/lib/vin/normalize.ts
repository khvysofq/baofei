import type { EnergyType, VehicleClass } from "./types";

export function normalizeVin(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** 17 位；只允许数字与 A–Z，且不含 I / O / Q。 */
export function isValidVin(input: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(input));
}

const YEAR_CODES: Record<string, number> = {
  "1": 2001,
  "2": 2002,
  "3": 2003,
  "4": 2004,
  "5": 2005,
  "6": 2006,
  "7": 2007,
  "8": 2008,
  "9": 2009,
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
};

/** VIN 第 10 位 → 年份；只在 30 年窗口内有效，超出返回 null。 */
export function vinYearFromVin(vin: string): number | null {
  if (vin.length !== 17) return null;
  return YEAR_CODES[vin[9]] ?? null;
}

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
  }
  const text = value.trim();
  if (!text || text === "-" || text === "—" || text === "null") return null;
  return text;
}

/** 抽取数字，容忍 "1318"、"1,318"、"1318kg"、"● 195/65 R15" 这类返回。 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cleanText(value);
  if (!text) return null;
  const matched = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

/**
 * 车价 → 分。支持「13.69万」「136900」「6.8万元」「13.69」。
 * 无单位时：≥1000 视为元，否则视为万元（乘用车指导价不会是 13 元）。
 */
export function parsePriceFen(value: unknown): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const base = parseNumber(text);
  if (base === null || base <= 0) return null;

  let yuan = base;
  if (text.includes("万")) {
    yuan = base * 10000;
  } else if (text.includes("千")) {
    yuan = base * 1000;
  } else if (text.includes("元")) {
    yuan = base;
  } else if (base < 1000) {
    yuan = base * 10000;
  }
  const fen = Math.round(yuan * 100);
  // 低于 3000 元或高于 2000 万的“车价”视为渠道脏数据。
  if (fen < 300_000 || fen > 2_000_000_000) return null;
  return fen;
}

const EMISSION_ROMAN: Record<string, string> = {
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
  "一": "I",
  "二": "II",
  "三": "III",
  "四": "IV",
  "五": "V",
  "六": "VI",
  "Ⅰ": "I",
  "Ⅱ": "II",
  "Ⅲ": "III",
  "Ⅳ": "IV",
  "Ⅴ": "V",
  "Ⅵ": "VI",
};

/** 「国四」「国4」「国Ⅳ」→「国 IV」；无法识别时原样返回。 */
export function normalizeEmission(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const matched = text.match(/^(国|欧)\s*(.+)$/);
  if (!matched) return text;
  const standard = matched[1] === "国" ? "国" : "欧";
  const raw = matched[2].trim().toUpperCase();
  const roman = EMISSION_ROMAN[raw] ?? EMISSION_ROMAN[raw.slice(0, 1)] ?? raw;
  return `${standard} ${roman}`;
}

export function inferEnergyType(fuelType: string | null): EnergyType {
  if (!fuelType) return "other";
  if (/纯电|电动|EV|BEV/i.test(fuelType)) return "electric";
  if (/插电|混动|混合|HEV|PHEV/i.test(fuelType)) return "hybrid";
  if (/柴油/.test(fuelType)) return "diesel";
  if (/汽油/.test(fuelType)) return "gasoline";
  return "other";
}

/**
 * 车型分类。渠道字段命名五花八门，这里只用车身形式 / 尺寸级别 / 车型名 / 座位数 / 整备质量
 * 做保守判断；判断不出来就返回 other，估值时按通用系数处理。
 */
export function classifyVehicle(input: {
  bodyType?: string | null;
  sizeType?: string | null;
  modelName?: string | null;
  seats?: number | null;
  weightKg?: number | null;
}): VehicleClass {
  const body = input.bodyType ?? "";
  const size = input.sizeType ?? "";
  const name = input.modelName ?? "";

  const fromText = (text: string): VehicleClass | null => {
    if (!text) return null;
    if (/皮卡/.test(text)) return "pickup";
    if (/SUV|越野/i.test(text)) return "suv";
    if (/MPV|商务车/i.test(text)) return "mpv";
    if (/货车|卡车|厢式|栏板|自卸|载货|牵引/.test(text)) return "truck";
    if (/客车|巴士/.test(text)) return "bus";
    if (/面包|微面/.test(text)) return "van";
    if (/掀背|三厢|两厢|轿车|跑车|硬顶|敞篷/.test(text)) return "sedan";
    return null;
  };

  const byBody = fromText(body);
  if (byBody) return byBody;

  const byName = fromText(name);
  if (byName) return byName;

  if (/SUV/i.test(size)) return "suv";
  if (/MPV/i.test(size)) return "mpv";
  if (/微|小型|紧凑|中型|中大型|大型|豪华/.test(size)) return "sedan";

  const weight = input.weightKg ?? null;
  const seats = input.seats ?? null;
  if (weight !== null && weight >= 4500) return "truck";
  if (weight !== null && weight >= 3000) return "truck";
  if (seats !== null && seats >= 9) return "bus";
  if (seats !== null && seats >= 7) return "mpv";
  return "other";
}

/** 展示用车辆类型。分类是推定的，报告里会标注「推定」。 */
export function vehicleTypeLabel(
  vehicleClass: VehicleClass,
  options: { isCommercial?: boolean | null; weightKg?: number | null; seats?: number | null } = {},
): string {
  const { isCommercial, weightKg, seats } = options;
  switch (vehicleClass) {
    case "sedan":
      return "小型轿车";
    case "suv":
      return "小型普通客车";
    case "mpv":
      return "小型普通客车";
    case "van":
      return isCommercial ? "轻型厢式货车" : "小型普通客车";
    case "pickup":
      return "轻型多用途货车";
    case "truck":
      if (weightKg !== null && weightKg !== undefined && weightKg >= 12000) return "重型货车";
      if (weightKg !== null && weightKg !== undefined && weightKg >= 4500) return "中型货车";
      return "轻型普通货车";
    case "bus":
      return seats !== null && seats !== undefined && seats >= 20 ? "大型客车" : "中型客车";
    default:
      return isCommercial ? "营运车辆" : "小型客车";
  }
}

const MISSING_LABELS: [keyof VinMissingInput, string][] = [
  ["curbWeightKg", "整备质量"],
  ["displacementMl", "排量"],
  ["emissionStandard", "排放标准"],
  ["modelYear", "年款"],
  ["fuelType", "燃料类型"],
  ["newCarPriceFen", "新车指导价"],
];

export type VinMissingInput = {
  curbWeightKg: number | null;
  displacementMl: number | null;
  emissionStandard: string | null;
  modelYear: number | null;
  fuelType: string | null;
  newCarPriceFen: number | null;
};

export function deriveMissingFields(spec: VinMissingInput): string[] {
  return MISSING_LABELS.filter(([key]) => spec[key] === null).map(([, label]) => label);
}