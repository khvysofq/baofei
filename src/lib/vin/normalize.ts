import type { EnergyType, VehicleClass } from "./types";

export function normalizeVin(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** 字符→数值（GB 16735 / ISO 3779）：I、O、Q 不参与编号，故不在表内。 */
const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

/** 第 1–17 位权重，第 9 位（校验位）权重为 0。 */
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** 年份位合法字符（30 年循环），排除 U、Z、0、I、O、Q。 */
const VIN_YEAR_CHARS = "123456789ABCDEFGHJKLMNPRSTVWXY";

/** 17 位结构校验：数字 + A–Z，排除 I / O / Q。 */
const VIN_STRUCTURE = /^[A-HJ-NPR-Z0-9]{17}$/;

export type VinValidationCode =
  | "EMPTY"
  | "LENGTH"
  | "CHARSET"
  | "CHECK_DIGIT_POSITION"
  | "YEAR_CODE"
  | "CHECK_DIGIT";

export type VinValidation = {
  ok: boolean;
  /** 归一化后的 VIN（去空格/短横线、大写） */
  vin: string;
  code: VinValidationCode | null;
  message: string;
  expectedCheckDigit: string | null;
  actualCheckDigit: string | null;
};

/**
 * 按 GB 16735 / ISO 3779 计算第 9 位校验码。
 * 加权和 mod 11，余数 10 记作 X；返回 null 表示字符集内没有对应值。
 */
export function computeVinCheckDigit(input: string): string | null {
  const vin = normalizeVin(input);
  if (vin.length !== 17) return null;

  let sum = 0;
  for (let index = 0; index < 17; index += 1) {
    const char = vin[index];
    const value = /\d/.test(char) ? Number(char) : VIN_TRANSLITERATION[char];
    if (value === undefined) return null;
    sum += value * VIN_WEIGHTS[index];
  }

  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

/**
 * VIN 合法性校验，按“结构 → 校验位位置 → 年份位 → 校验位”逐层报错。
 *
 * `checkDigit: false` 只放宽模 11 校验（部分老旧国产/改装车 VIN 不符合校验位），
 * 长度、字符集、第 9 位与年份位始终校验——这些不通过一定不是有效 VIN。
 */
export function validateVin(
  input: string,
  options: { checkDigit?: boolean } = {},
): VinValidation {
  const vin = normalizeVin(input);
  const fail = (
    code: VinValidationCode,
    message: string,
    extra: Partial<VinValidation> = {},
  ): VinValidation => ({
    ok: false,
    vin,
    code,
    message,
    expectedCheckDigit: extra.expectedCheckDigit ?? null,
    actualCheckDigit: extra.actualCheckDigit ?? null,
  });

  if (!vin) return fail("EMPTY", "请填写车辆识别代号（VIN）。");

  if (vin.length !== 17) {
    return fail("LENGTH", `VIN 应为 17 位，当前 ${vin.length} 位，请核对后重试。`);
  }

  if (!VIN_STRUCTURE.test(vin)) {
    return fail(
      "CHARSET",
      "VIN 只能包含数字和字母，且不含 I、O、Q，请核对行驶证上的车辆识别代号。",
    );
  }

  if (!/^[0-9X]$/.test(vin[8])) {
    return fail("CHECK_DIGIT_POSITION", "VIN 第 9 位应为校验位（0–9 或 X）。");
  }

  if (!VIN_YEAR_CHARS.includes(vin[9])) {
    return fail("YEAR_CODE", "VIN 第 10 位不是有效的年份代码，请核对后重试。");
  }

  if (options.checkDigit !== false) {
    const expected = computeVinCheckDigit(vin);
    if (expected === null) {
      return fail("CHARSET", "VIN 含有无法识别的字符，请核对后重试。");
    }
    if (expected !== vin[8]) {
      return fail(
        "CHECK_DIGIT",
        `VIN 校验位不匹配（第 9 位应为 ${expected}，实际为 ${vin[8]}），请核对行驶证后重试。`,
        { expectedCheckDigit: expected, actualCheckDigit: vin[8] },
      );
    }
  }

  return {
    ok: true,
    vin,
    code: null,
    message: "",
    expectedCheckDigit: vin[8],
    actualCheckDigit: vin[8],
  };
}

/** 布尔快捷方式：17 位 + 字符集 + 校验位全通过。 */
export function isValidVin(input: string): boolean {
  return validateVin(input).ok;
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