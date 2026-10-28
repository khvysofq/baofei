import type {
  CoreFieldName,
  FieldValue,
  ParseConflict,
  ParseFieldResult,
  ParseOption,
  ParseResult,
  RegionValue,
} from "@/lib/types";
import { CORE_FIELD_NAMES } from "@/lib/types";
import {
  CITY_ALIASES,
  PROVINCES,
  SICHUAN_CITIES,
  normalizeCityName,
  normalizeRegion,
} from "@/lib/domain/regions";

const KNOWN_PLACES = [
  ...SICHUAN_CITIES,
  "重庆",
  "北京",
  "上海",
  "天津",
  "云南",
  "贵州",
  "陕西",
  "甘肃",
  "西藏",
  "青海",
  "湖北",
  "湖南",
  "广东",
  "浙江",
  "江苏",
  "河南",
  "山东",
  ...Object.keys(CITY_ALIASES),
];

const MUNICIPALITIES = new Set(["重庆", "北京", "上海", "天津"]);

function regionFromPhrase(phrase: string | null | undefined): RegionValue | null {
  if (!phrase) return null;
  const text = phrase.replace(/\s+/g, "");
  // 市州名称优先（含别名），避免“四川成都”被拆成两级
  const cityCandidates = [...KNOWN_PLACES].sort((a, b) => b.length - a.length);
  for (const candidate of cityCandidates) {
    if (!text.includes(candidate)) continue;
    const city = normalizeCityName(candidate);
    if (city) return { province: "四川", city };
    const province = PROVINCES.find((p) => candidate.startsWith(p));
    if (province && MUNICIPALITIES.has(province)) {
      return { province, city: province };
    }
  }
  for (const p of PROVINCES) {
    if (text.includes(p)) {
      return MUNICIPALITIES.has(p) ? { province: p, city: p } : { province: p, city: null };
    }
  }
  if (text.includes("川牌") || text.includes("川A") || text.includes("川")) {
    return { province: "四川", city: null };
  }
  return null;
}


function extractVehicleLocation(text: string): RegionValue | null {
  const patterns = [
    /(?:车|车子|车辆)(?:现在|目前|现)?(?:在|位于|停放在?|是)([^，。；,;！？]{1,12})/,
    /(?:我|本人)在([^，。；,;！？]{1,12})/,
    /在([^，。；,;！？]{1,6})(?:开不动|不能开|报废|办理|使用)/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const region = regionFromPhrase(m[1]);
    if (region) return region;
  }
  return null;
}

function extractRegistrationLocation(text: string): RegionValue | null {
  const patterns = [
    /登记(?:地|在|于|是|为)?([^，。；,;！？的]{1,12})/,
    /(?:上的|挂的|牌照(?:是|在)?)([^，。；,;！？]{1,10}?)(?:牌|牌照|户|的)/,
    /([^，。；,;！？\s]{2,6})(?:登记|牌照|牌|户)(?:的|了)?/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const region = regionFromPhrase(m[1]);
    if (region) return region;
  }
  return null;
}

function extractIntent(text: string): { value: "scrap" | "replace" | null; confidence: number } {
  const negativeReplace =
    /(?:不|没|别|不想|不打算|暂不|无需)[^，。；,;！？]{0,8}(?:换新|换车|买新车|购买新车|购置新车)/.test(
      text,
    );
  const explicitScrap =
    /(?:只|仅)(?:想|要|打算|是)?(?:报废|注销)/.test(text) ||
    /不买新车|不换新|不打算换新|只报废|仅报废/.test(text);

  const positiveReplace =
    /(?:换新|以旧换新|买新车|购买新车|购置新车|换一辆新车|买辆新车|换车)/.test(text);

  if (negativeReplace || explicitScrap) {
    return { value: "scrap", confidence: negativeReplace ? 0.95 : 0.9 };
  }
  if (positiveReplace) {
    return { value: "replace", confidence: 0.9 };
  }
  if (/报废|注销/.test(text)) {
    return { value: "scrap", confidence: 0.55 };
  }
  return { value: null, confidence: 0 };
}

function extractDocuments(text: string): {
  value: "complete" | "missing_registration" | null;
  confidence: number;
} {
  const missing =
    /(?:登记证|绿本|机动车登记证书)[^，。；,;！？]{0,10}(?:找不到|不见了?|丢失|丢了|缺失|没有|没带|没在)/.test(
      text,
    ) ||
    /(?:找不到|不见了?|丢失|没有)[^，。；,;！？]{0,10}(?:登记证|绿本|机动车登记证书)/.test(
      text,
    );
  if (missing) return { value: "missing_registration", confidence: 0.95 };

  const complete =
    /(?:证件|材料)(?:都|很)?(?:齐全|完整|都有|齐)/.test(text) ||
    /(?:行驶证|登记证)[^，。；,;！？]{0,12}(?:都|均)?(?:在|有|齐全)/.test(text) ||
    /(?:行驶证和登记证|登记证和行驶证)/.test(text);
  if (complete) return { value: "complete", confidence: 0.85 };
  return { value: null, confidence: 0 };
}

function extractOwnerRelation(text: string): {
  value: "self" | "family" | null;
  confidence: number;
} {
  const family =
    /(?:帮|替|给|代)(?:我)?(?:爸|妈|父亲|母亲|家人|老人|朋友|亲戚|爱人|老婆|丈夫|哥|姐|弟|妹|爷爷|奶奶)/.test(
      text,
    ) || /(?:家人|亲属|老人|父亲|母亲)[^，。；,;！？]{0,8}(?:办理|代办)/.test(text) ||
    /(?:代办|委托办理|代家人)/.test(text);
  if (family) return { value: "family", confidence: 0.9 };
  if (/(?:本人|我自己|自己|我)(?:来)?办理|本人/.test(text)) {
    return { value: "self", confidence: 0.85 };
  }
  return { value: null, confidence: 0 };
}

function extractDrivable(text: string): { value: boolean | null; confidence: number } {
  if (
    /(?:开不动|不能开|没法开|无法行驶|无法移动|动不了|抛锚|趴窝|需要拖车|要拖车|车坏了)/.test(
      text,
    )
  ) {
    return { value: false, confidence: 0.9 };
  }
  if (/(?:能开|可以开|开得动|正常行驶|能正常|还能开)/.test(text)) {
    return { value: true, confidence: 0.9 };
  }
  return { value: null, confidence: 0 };
}

function toField(value: FieldValue, confidence: number): ParseFieldResult {
  return {
    value,
    source: value === null ? "unknown" : "text",
    confirmed: false,
    confidence,
  };
}

function knownValue(
  known: Partial<Record<CoreFieldName, { value: FieldValue; confirmed: boolean; source?: ParseFieldResult["source"] }>> | undefined,
  field: CoreFieldName,
): { value: FieldValue; confirmed: boolean; source: ParseFieldResult["source"] } | null {
  const k = known?.[field];
  if (!k) return null;
  return { value: k.value, confirmed: k.confirmed, source: k.source ?? "user" };
}

/**
 * 确定性规则解析：先处理否定词，再匹配关键词。
 * 未说明字段保留 unknown（null），绝不臆测；任何异常都降级为选项，不抛 500。
 */
export function parseIntake(
  rawText: string,
  knownFields?: Partial<
    Record<CoreFieldName, { value: FieldValue; confirmed: boolean; source?: ParseFieldResult["source"] }>
  >,
): Omit<ParseResult, "source"> {
  try {
    const text = (rawText ?? "").trim().slice(0, 500);
    if (!text) {
      return {
        fields: {
          vehicleLocation: toField(null, 0),
          registrationLocation: toField(null, 0),
          ownerRelation: toField(null, 0),
          drivable: toField(null, 0),
          intent: toField(null, 0),
          documentsStatus: toField(null, 0),
        },
        conflicts: [],
        degraded: true,
        options: buildOptions({}),
        demo: true,
      };
    }

    const intent = extractIntent(text);
    const docs = extractDocuments(text);
    const relation = extractOwnerRelation(text);
    const drivable = extractDrivable(text);
    const vehicleRegion = extractVehicleLocation(text);
    const registrationRegion = extractRegistrationLocation(text);

    const parsed: Record<CoreFieldName, ParseFieldResult> = {
      vehicleLocation: toField(vehicleRegion, vehicleRegion?.city ? 0.9 : vehicleRegion ? 0.5 : 0),
      registrationLocation: toField(
        registrationRegion,
        registrationRegion?.city ? 0.9 : registrationRegion ? 0.5 : 0,
      ),
      ownerRelation: toField(relation.value, relation.confidence),
      drivable: toField(drivable.value, drivable.confidence),
      intent: toField(intent.value, intent.confidence),
      documentsStatus: toField(docs.value, docs.confidence),
    };

    const conflicts: ParseConflict[] = [];

    for (const field of CORE_FIELD_NAMES) {
      const known = knownValue(knownFields, field);
      if (!known) continue;
      const candidate = parsed[field].value;
      // 只与“已确认”的字段比较；unknown 不是冲突。
      if (
        known.confirmed &&
        candidate !== null &&
        !sameValue(known.value, candidate)
      ) {
        conflicts.push({
          field,
          kept: known.value,
          candidate,
          message: "新描述与已确认字段不一致，请选择采用哪一个值。",
        });
        parsed[field] = {
          value: known.value,
          source: known.source,
          confirmed: true,
          confidence: 1,
        };
      } else if (known.confirmed) {
        parsed[field] = {
          value: known.value,
          source: known.source,
          confirmed: true,
          confidence: 1,
        };
      }
    }

    const allUnknown = CORE_FIELD_NAMES.every(
      (f) => parsed[f].value === null,
    );

    return {
      fields: parsed,
      conflicts,
      degraded: allUnknown,
      options: buildOptions(parsed),
      demo: true,
    };
  } catch {
    const fields = Object.fromEntries(
      CORE_FIELD_NAMES.map((f) => [f, toField(null, 0)]),
    ) as Record<CoreFieldName, ParseFieldResult>;
    return {
      fields,
      conflicts: [],
      degraded: true,
      options: buildOptions({}),
      demo: true,
    };
  }
}

function sameValue(a: FieldValue, b: FieldValue): boolean {
  if (typeof a === "object" && typeof b === "object") {
    return (
      (a as RegionValue | null)?.province === (b as RegionValue | null)?.province &&
      (a as RegionValue | null)?.city === (b as RegionValue | null)?.city
    );
  }
  return a === b;
}

function buildOptions(
  parsed: Partial<Record<CoreFieldName, ParseFieldResult>>,
): ParseOption[] {
  const options: ParseOption[] = [];
  const unknown = (field: CoreFieldName) => parsed[field]?.value == null;

  if (unknown("vehicleLocation")) {
    options.push({
      field: "vehicleLocation",
      label: "车辆现在在哪里？",
      choices: [
        { value: normalizeRegion("成都"), label: "四川·成都" },
        { value: normalizeRegion("绵阳"), label: "四川·绵阳" },
        { value: { province: "四川", city: null }, label: "四川，市州待确认" },
        { value: { province: null, city: null }, label: "不清楚" },
      ],
    });
  }
  if (unknown("registrationLocation")) {
    options.push({
      field: "registrationLocation",
      label: "车辆登记地在哪里？",
      choices: [
        { value: normalizeRegion("成都"), label: "四川·成都" },
        { value: normalizeRegion("绵阳"), label: "四川·绵阳" },
        { value: normalizeRegion("重庆"), label: "重庆（省外）" },
        { value: { province: null, city: null }, label: "不清楚" },
      ],
    });
  }
  if (unknown("ownerRelation")) {
    options.push({
      field: "ownerRelation",
      label: "由谁办理？",
      choices: [
        { value: "self", label: "车主本人" },
        { value: "family", label: "家人或他人协助" },
        { value: null, label: "不清楚" },
      ],
    });
  }
  if (unknown("drivable")) {
    options.push({
      field: "drivable",
      label: "车辆还能开吗？",
      choices: [
        { value: true, label: "能正常行驶" },
        { value: false, label: "开不动，需要拖运" },
        { value: null, label: "不清楚" },
      ],
    });
  }
  if (unknown("intent")) {
    options.push({
      field: "intent",
      label: "办理目标是什么？",
      choices: [
        { value: "scrap", label: "仅报废" },
        { value: "replace", label: "报废并换新" },
        { value: null, label: "还不确定" },
      ],
    });
  }
  if (unknown("documentsStatus")) {
    options.push({
      field: "documentsStatus",
      label: "证件情况如何？",
      choices: [
        { value: "complete", label: "行驶证和登记证都在" },
        { value: "missing_registration", label: "登记证（绿本）暂时找不到" },
        { value: null, label: "不清楚" },
      ],
    });
  }
  return options;
}