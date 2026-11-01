/**
 * 报废残值评估 · 演示规则引擎
 *
 * 说明：样例版不接真实 OCR、VIN 解码库与行情接口。
 * - VIN 模式：只按 VIN 第 1–3 位（WMI）与第 10 位（年款）做演示解析，其余参数为车型推定值。
 * - 上传模式：证件字段来自内置演示车型，上传文件只用于生成稳定的评估编号与车况系数。
 * 服务端不保存原图与 VIN 明文以外的内容。
 */

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

export type ValuationReport = {
  reportNo: string;
  assessedAt: string;
  validUntil: string;
  source: ValuationSource;
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
      vin: "LSVAA49J1C2345678",
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
      vin: "LZWADAGA5F8123456",
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
      vin: "LGDCH81G5B1234567",
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

export function normalizeVin(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** 17 位；只允许数字与 A–Z，且不含 I / O / Q。 */
export function isValidVin(input: string): boolean {
  const vin = normalizeVin(input);
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

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
    year: YEAR_CODES[vin[9]] ?? 2012,
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

export function buildValuationReport(options: {
  seed: string;
  source?: ValuationSource;
  vin?: string;
  sample?: boolean;
  now?: Date;
}): ValuationReport {
  const now = options.now ?? new Date();
  const source: ValuationSource = options.source ?? (options.vin ? "vin" : "license");
  const vinMode = source === "vin";
  const vin = vinMode ? normalizeVin(options.vin ?? "") : options.sample ? PRESETS[0].profile.vin : "";
  const decoded = vinMode ? decodeVin(vin) : null;

  const preset = vinMode
    ? PRESETS[decoded!.presetIndex]
    : options.sample
      ? PRESETS[0]
      : PRESETS[hashByte(options.seed, 0) % PRESETS.length];

  const tier = CONDITION_TIERS[
    options.sample ? 0 : hashByte(options.seed, 1) % CONDITION_TIERS.length
  ];

  const profile: VehicleProfile = vinMode
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
    ? Math.max(0, Math.round(((now.getTime() - new Date(`${decoded!.year}-07-01T00:00:00Z`).getTime()) / (365.2425 * 24 * 60 * 60 * 1000)) * 10) / 10)
    : yearsSince(profile.registerDate ?? preset.profile.registerDate ?? "2012-01-01", now);

  const steelFen = roundToYuan(
    profile.curbWeightKg * preset.steelRatio * (preset.scrapPricePerTonFen / 1000),
  );
  const nonFerrousFen = roundToYuan(
    preset.nonFerrousKg * preset.nonFerrousPricePerKgFen,
  );

  const items: ValuationItem[] = [
    {
      key: "steel",
      label: "废钢残值",
      basis: `整备质量 ${profile.curbWeightKg}kg × 可回收金属 ${Math.round(
        preset.steelRatio * 100,
      )}% × ${(preset.scrapPricePerTonFen / 100000).toFixed(2)} 元/kg`,
      amountFen: steelFen,
    },
    {
      key: "nonferrous",
      label: "有色金属",
      basis: `铝制件与铜线束约 ${preset.nonFerrousKg}kg × ${(
        preset.nonFerrousPricePerKgFen / 100
      ).toFixed(0)} 元/kg`,
      amountFen: nonFerrousFen,
    },
    {
      key: "catalyst",
      label: "三元催化器",
      basis: preset.catalystNote,
      amountFen: preset.catalystFen,
    },
    {
      key: "battery",
      label: "蓄电池",
      basis: preset.batteryNote,
      amountFen: preset.batteryFen,
    },
    {
      key: "wheels",
      label: "轮胎与轮毂",
      basis: "4 套 · 按可回收成色计价",
      amountFen: preset.wheelsFen,
    },
    {
      key: "misc",
      label: "其他可回收件",
      basis: "起动机、发电机、散热器等",
      amountFen: preset.miscFen,
    },
  ];

  const grossFen = items.reduce((sum, item) => sum + item.amountFen, 0);

  const deductions: DeductionItem[] = [
    {
      label: "拆解与环保处置",
      basis: "废油液、冷媒、破碎分选",
      amountFen: preset.dismantleFen,
    },
    {
      label: "拖运与上门服务",
      basis: "成都绕城内 · 可自行送车减免",
      amountFen: preset.towingFen,
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

  const factors: PriceFactor[] = [
    {
      label: `车龄 ${ageYears} 年`,
      detail: vinMode
        ? "按 VIN 第 10 位年款推算，实际以首次登记日期为准"
        : "可回用件价值随车龄下降，废钢计价不受影响",
      tone: ageYears >= 12 ? "down" : "flat",
    },
    {
      label: `排放 ${profile.emission}`,
      detail:
        profile.emission.includes("III")
          ? "四川地区可办理报废，部分回收企业限收"
          : "四川地区可正常办理注销与回收",
      tone: "flat",
    },
    {
      label: "三元催化器",
      detail:
        preset.catalystFen >= 40000
          ? "原装件含贵金属，可单独计价"
          : "载体残值有限，按普通废件计",
      tone: preset.catalystFen >= 40000 ? "up" : "down",
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
      label: `整备质量 ${profile.curbWeightKg}kg`,
      detail: vinMode
        ? "同平台车型推定值，现场称重为准"
        : "废钢计价的主要基数，称重以现场为准",
      tone: "flat",
    },
    {
      label: "地区行情 四川·成都",
      detail: "按本地回收企业近期成交区间测算",
      tone: "flat",
    },
  ];

  const estimatedFields = vinMode
    ? ["使用性质", "整备质量", "排量", "排放标准", "三元催化状态"]
    : [];

  return {
    reportNo: `BF-${stamp}-${options.seed.slice(0, 4).toUpperCase()}`,
    assessedAt: now.toISOString(),
    validUntil,
    source,
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
    confidence: {
      level: tier.label === "需现场核验" ? "中" : "较高",
      note: `依据${vinMode ? "VIN 解析与车型系数" : "证件信息与车型系数"}测算 · ${tier.note}`,
    },
    factors,
    suggestions: [
      vinMode
        ? "补充行驶证照片可校准首次登记日期、号牌与使用性质，区间会更准。"
        : "交车前清空车内物品，随车带好行驶证、机动车登记证书与号牌。",
      "三元催化器、蓄电池不要自行拆卖，缺件通常按 10%–15% 扣减。",
      "报告 7 天内有效，最终结算以回收企业现场验车与称重结果为准。",
    ],
    estimatedFields,
    mode: "demo",
  };
}