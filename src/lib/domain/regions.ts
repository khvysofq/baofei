import type { RegionValue } from "@/lib/types";

/** 四川省 21 个市（州）的地区配置。 */
export const SICHUAN_CITIES = [
  "成都",
  "自贡",
  "攀枝花",
  "泸州",
  "德阳",
  "绵阳",
  "广元",
  "遂宁",
  "内江",
  "乐山",
  "南充",
  "眉山",
  "宜宾",
  "广安",
  "达州",
  "雅安",
  "巴中",
  "资阳",
  "阿坝",
  "甘孜",
  "凉山",
] as const;

export const CITY_ALIASES: Record<string, string> = {
  成都市: "成都",
  蓉城: "成都",
  阿坝州: "阿坝",
  阿坝藏族羌族自治州: "阿坝",
  甘孜州: "甘孜",
  甘孜藏族自治州: "甘孜",
  凉山州: "凉山",
  凉山彝族自治州: "凉山",
};

/** 省级行政区（地区数据，含直辖市）。 */
export const PROVINCES = [
  "四川",
  "重庆",
  "北京",
  "上海",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
] as const;

const MUNICIPALITIES = new Set(["重庆", "北京", "上海", "天津"]);

const CITY_TO_PROVINCE = new Map<string, string>(
  SICHUAN_CITIES.map((city) => [city, "四川"]),
);

export function emptyRegion(): RegionValue {
  return { province: null, city: null };
}

export function isRegionUnknown(region: RegionValue | null | undefined): boolean {
  return !region || !region.province;
}

export function normalizeCityName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim().replace(/\s+/g, "");
  if (!text) return null;
  if (CITY_ALIASES[text]) return CITY_ALIASES[text];
  if (CITY_TO_PROVINCE.has(text)) return text;
  if (text.endsWith("市")) {
    const base = text.slice(0, -1);
    if (CITY_TO_PROVINCE.has(base)) return base;
    if (CITY_ALIASES[base]) return CITY_ALIASES[base];
  }
  return null;
}

export function normalizeProvinceName(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let text = raw.trim().replace(/\s+/g, "");
  if (!text) return null;
  if (text.endsWith("省") || text.endsWith("市")) text = text.slice(0, -1);
  if (text === "川" || text === "蜀") return "四川";
  if (text === "渝") return "重庆";
  if (PROVINCES.includes(text as (typeof PROVINCES)[number])) return text;
  if (MUNICIPALITIES.has(text)) return text;
  return null;
}

/**
 * 把自由文本归一化为结构化地区。
 * 只出现“四川”时不补成都；市州保持 null（unknown）。
 */
export function normalizeRegion(raw: string | RegionValue | null | undefined): RegionValue {
  if (!raw) return emptyRegion();
  if (typeof raw !== "string") {
    const province = normalizeProvinceName(raw.province);
    const city = normalizeCityName(raw.city);
    if (city) {
      return { province: CITY_TO_PROVINCE.get(city) ?? province, city };
    }
    if (province && MUNICIPALITIES.has(province)) {
      return { province, city: province };
    }
    return { province, city: null };
  }

  const text = raw.trim().replace(/\s+/g, "");
  if (!text) return emptyRegion();

  // 先尝试市州级别，可带“市/州”后缀
  const city = normalizeCityName(text);
  if (city) {
    return { province: CITY_TO_PROVINCE.get(city) ?? "四川", city };
  }

  const province = normalizeProvinceName(text);
  if (province) {
    if (MUNICIPALITIES.has(province)) return { province, city: province };
    return { province, city: null };
  }

  // 形如“四川成都”“四川省成都市”
  for (const candidate of SICHUAN_CITIES) {
    if (text.includes(candidate)) {
      return { province: "四川", city: candidate };
    }
  }
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (text.includes(alias)) {
      return { province: "四川", city: canonical };
    }
  }
  for (const p of PROVINCES) {
    if (text.startsWith(p) || text.endsWith(p)) {
      return p === "重庆" ? { province: p, city: p } : { province: p, city: null };
    }
  }
  return emptyRegion();
}

export function regionLabel(region: RegionValue | null | undefined): string {
  if (!region || !region.province) return "待确认";
  if (!region.city) return `${region.province}·市州待确认`;
  if (region.province === region.city) return region.city;
  return `${region.province}·${region.city}`;
}

export function sameRegion(
  a: RegionValue | null | undefined,
  b: RegionValue | null | undefined,
): boolean {
  return (
    !!a &&
    !!b &&
    a.province === b.province &&
    a.city === b.city
  );
}

export type LocationRelation =
  | "same_city"
  | "same_province"
  | "cross_province"
  | "unknown";

/**
 * 车辆所在地 vs 登记地。
 * “成都 / 成都市”归一化后视为同地；缺任一方或市州未知 → unknown（不猜）。
 */
export function classifyLocations(
  vehicle: RegionValue | null | undefined,
  registration: RegionValue | null | undefined,
): LocationRelation {
  if (!vehicle?.province || !registration?.province) return "unknown";
  if (!vehicle.city || !registration.city) return "unknown";
  if (vehicle.province !== registration.province) return "cross_province";
  if (vehicle.city === registration.city) return "same_city";
  return "same_province";
}

export function cityInSichuan(city: string | null | undefined): boolean {
  if (!city) return false;
  return normalizeCityName(city) !== null;
}