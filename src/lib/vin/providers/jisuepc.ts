import {
  classifyVehicle,
  cleanText,
  deriveMissingFields,
  inferEnergyType,
  normalizeEmission,
  parseInteger,
  parseNumber,
  parsePriceFen,
  vinYearFromVin,
} from "../normalize";
import {
  VinQueryError,
  type VinProvider,
  type VinProviderResult,
  type VinQueryContext,
} from "../types";

/**
 * 极速车服（jisuepc）VIN 查询渠道
 *
 * 文档：https://www.jisuepc.com/api/vin/
 * GET https://api.jisuepc.com/vin/query?appkey=...&vin=...
 *
 * ⚠️ 该接口 status 时而返回数字 0、时而返回字符串 "210"，
 * 且不校验 VIN 长度（16 位也能查），所以业务层必须自己先做 17 位校验。
 */

const DEFAULT_BASE_URL = "https://api.jisuepc.com";
const MAX_RESPONSE_BYTES = 512 * 1024;

const STATUS_MAP: Record<
  string,
  { code: VinQueryError["code"]; retryable: boolean; fallback: boolean }
> = {
  "201": { code: "INVALID_VIN", retryable: false, fallback: false },
  "202": { code: "INVALID_VIN", retryable: false, fallback: false },
  "210": { code: "NOT_FOUND", retryable: true, fallback: true },
  // 渠道侧账号/权限问题：换渠道仍有意义。
  "101": { code: "UNAUTHORIZED", retryable: true, fallback: true },
  "102": { code: "UNAUTHORIZED", retryable: true, fallback: true },
  "103": { code: "UNAUTHORIZED", retryable: true, fallback: true },
  "104": { code: "QUOTA_EXCEEDED", retryable: true, fallback: true },
  "105": { code: "IP_BLOCKED", retryable: true, fallback: true },
  "106": { code: "RATE_LIMITED", retryable: true, fallback: true },
  "107": { code: "MAINTENANCE", retryable: true, fallback: true },
  "108": { code: "MAINTENANCE", retryable: true, fallback: true },
};

type JisuepcPayload = {
  status?: unknown;
  msg?: unknown;
  result?: unknown;
};

type JisuepcVehicle = Record<string, unknown>;

function statusKey(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function fail(
  code: VinQueryError["code"],
  message: string,
  options: { upstreamCode?: string | number | null; retryable?: boolean; latencyMs?: number } = {},
): never {
  throw new VinQueryError({
    code,
    message,
    providerId: "jisuepc",
    providerLabel: "极速车服",
    upstreamCode: options.upstreamCode ?? null,
    retryable: options.retryable ?? true,
    latencyMs: options.latencyMs ?? 0,
  });
}

function mapVehicle(vehicle: JisuepcVehicle, vin: string, latencyMs: number): VinProviderResult {
  if (vehicle.iscorrect === 0 || vehicle.iscorrect === "0") {
    fail("INVALID_VIN", "极速车服判定该 VIN 不符合校验规则", {
      upstreamCode: "iscorrect=0",
      retryable: false,
      latencyMs,
    });
  }

  const displacementFromL = parseNumber(cleanText(vehicle.displacement));
  const displacementMl =
    parseInteger(vehicle.displacementml) ??
    (displacementFromL === null ? null : Math.round(displacementFromL * 1000));

  const yearText = cleanText(vehicle.yeartype);
  const yearMatched = yearText?.match(/(19|20)\d{2}/);
  const modelYear = yearMatched ? Number(yearMatched[0]) : null;

  const weightKg = parseInteger(vehicle.weight);
  const seats = parseInteger(vehicle.seatnum);
  const bodyType = cleanText(vehicle.bodytype) ?? cleanText(vehicle.carbody);
  const sizeType = cleanText(vehicle.sizetype);
  const modelName = cleanText(vehicle.name);
  const fuelType = cleanText(vehicle.fueltype);
  const isCommercialRaw = vehicle.iscommercial;
  const isImportRaw = vehicle.isimport;

  const base = {
    vin,
    brand: cleanText(vehicle.brand),
    manufacturer: cleanText(vehicle.manufacturer),
    modelName,
    seriesName: cleanText(vehicle.typename),
    modelYear,
    vinYear: vinYearFromVin(vin),
    vehicleClass: classifyVehicle({ bodyType, sizeType, modelName, seats, weightKg }),
    bodyType,
    sizeType,
    displacementMl,
    fuelType,
    energyType: inferEnergyType(fuelType),
    emissionStandard: normalizeEmission(vehicle.environmentalstandards),
    curbWeightKg: weightKg,
    seats,
    gearbox: cleanText(vehicle.geartype) ?? cleanText(vehicle.gearbox),
    driveMode: cleanText(vehicle.drivemode),
    newCarPriceFen: parsePriceFen(vehicle.price),
    isCommercial:
      isCommercialRaw === 1 || isCommercialRaw === "1"
        ? true
        : isCommercialRaw === 0 || isCommercialRaw === "0"
          ? false
          : null,
    isImport:
      isImportRaw === 1 || isImportRaw === "1"
        ? true
        : isImportRaw === 0 || isImportRaw === "0"
          ? false
          : null,
    fetchedAt: new Date().toISOString(),
  };

  return {
    spec: { ...base, missingFields: deriveMissingFields(base) },
    raw: vehicle,
  };
}

export const jisuepcProvider: VinProvider = {
  id: "jisuepc",
  label: "极速车服",
  costFenPerQuery: 4.5,

  isConfigured(): boolean {
    return Boolean(process.env.JISUEPC_APPKEY?.trim());
  },

  async query(vin: string, context: VinQueryContext): Promise<VinProviderResult> {
    const appkey = process.env.JISUEPC_APPKEY?.trim();
    if (!appkey) {
      fail("NOT_CONFIGURED", "未配置 JISUEPC_APPKEY", { retryable: false });
    }

    const baseUrl = (process.env.JISUEPC_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const url = new URL(`${baseUrl}/vin/query`);
    url.searchParams.set("appkey", appkey);
    url.searchParams.set("vin", vin);
    if (process.env.JISUEPC_STRICT === "1") url.searchParams.set("strict", "1");

    const timeout = AbortSignal.timeout(context.timeoutMs);
    const signal = AbortSignal.any([context.signal, timeout]);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "baofei-vin/1.0" },
        signal,
        cache: "no-store",
      });
    } catch {
      const latencyMs = Date.now() - startedAt;
      const timedOut = timeout.aborted;
      fail(
        timedOut ? "TIMEOUT" : "NETWORK",
        timedOut ? "极速车服查询超时" : "无法连接极速车服",
        { retryable: true, latencyMs },
      );
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      fail("UPSTREAM_ERROR", `极速车服返回 HTTP ${response.status}`, {
        upstreamCode: response.status,
        retryable,
        latencyMs,
      });
    }

    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      fail("BAD_RESPONSE", "极速车服返回内容过大", { retryable: true, latencyMs });
    }

    let payload: JisuepcPayload;
    try {
      payload = JSON.parse(text) as JisuepcPayload;
    } catch {
      fail("BAD_RESPONSE", "极速车服返回内容不是合法 JSON", { retryable: true, latencyMs });
    }

    const key = statusKey(payload.status);
    if (key !== "0") {
      const mapped = STATUS_MAP[key];
      fail(
        mapped?.code ?? "UPSTREAM_ERROR",
        cleanText(payload.msg) ?? `极速车服返回状态 ${key || "未知"}`,
        {
          upstreamCode: key || null,
          retryable: mapped?.retryable ?? true,
          latencyMs,
        },
      );
    }

    if (!payload.result || typeof payload.result !== "object") {
      fail("NOT_FOUND", "极速车服没有返回车型信息", {
        upstreamCode: key,
        retryable: true,
        latencyMs,
      });
    }

    return mapVehicle(payload.result as JisuepcVehicle, vin, latencyMs);
  },
};