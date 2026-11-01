import { afterEach, describe, expect, it, vi } from "vitest";
import { buildValuationReport } from "@/lib/valuation/engine";
import { jisuepcProvider } from "@/lib/vin/providers/jisuepc";
import { listVinProviders, queryVin, registerVinProvider } from "@/lib/vin";
import {
  computeVinCheckDigit,
  isValidVin,
  normalizeEmission,
  normalizeVin,
  parsePriceFen,
  validateVin,
} from "@/lib/vin/normalize";
import { VinQueryError, type VinProvider } from "@/lib/vin/types";

const SAMPLE_VIN = "LSVAL41Z882104202";
const NOW = new Date("2026-11-01T08:00:00Z");

const SAMPLE_PAYLOAD = {
  status: 0,
  msg: "ok",
  result: {
    carid: 28006,
    vin: SAMPLE_VIN,
    name: "明锐 2009款 1.6L 自动逸致版",
    brand: "斯柯达",
    manufacturer: "上汽大众斯柯达",
    typename: "明锐",
    displacement: "1.6L",
    displacementml: "1598",
    yeartype: "2009",
    environmentalstandards: "国四",
    fueltype: "汽油",
    gearbox: "6挡手自一体",
    geartype: "手自一体变速箱(AT)",
    drivemode: "前置前驱",
    bodytype: "掀背车",
    sizetype: "紧凑型车",
    seatnum: "5",
    weight: "1318",
    price: "13.69万",
    iscommercial: 0,
    isimport: 0,
    iscorrect: 1,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(body: unknown, status = 200) {
  const spy = vi.fn(async () => jsonResponse(body, status));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VIN 归一化与字段解析", () => {
  it("兼容空格、短横线与大小写", () => {
    expect(normalizeVin(" lsv-al41z 882104202 ")).toBe(SAMPLE_VIN);
    expect(isValidVin(SAMPLE_VIN)).toBe(true);
    expect(isValidVin(`${SAMPLE_VIN}0`)).toBe(false);
  });

  it("按国标计算并校验第 9 位校验码", () => {
    expect(computeVinCheckDigit(SAMPLE_VIN)).toBe("8");
    expect(computeVinCheckDigit("1HGCM82633A004352")).toBe("3");
    expect(validateVin(SAMPLE_VIN).ok).toBe(true);
  });

  it("逐层给出校验失败原因，且不合法时不放行", () => {
    expect(validateVin("")).toMatchObject({ ok: false, code: "EMPTY" });
    expect(validateVin("LSVAA49J5C234567")).toMatchObject({ ok: false, code: "LENGTH" });
    expect(validateVin("LSVAA49J5C23456I8")).toMatchObject({ ok: false, code: "CHARSET" });
    expect(validateVin("LSVAA49JAC2345678")).toMatchObject({
      ok: false,
      code: "CHECK_DIGIT_POSITION",
    });
    expect(validateVin("LSVAA49J5U2345678")).toMatchObject({ ok: false, code: "YEAR_CODE" });

    const mismatch = validateVin("LSVAA49J1C2345678");
    expect(mismatch).toMatchObject({
      ok: false,
      code: "CHECK_DIGIT",
      expectedCheckDigit: "5",
      actualCheckDigit: "1",
    });
    expect(mismatch.message).toContain("校验位");
  });

  it("可选关闭模 11 校验，结构校验仍然生效", () => {
    expect(validateVin("LSVAA49J1C2345678", { checkDigit: false }).ok).toBe(true);
    expect(validateVin("LSVAA49J1C23456I8", { checkDigit: false }).ok).toBe(false);
  });

  it("排放标准统一成罗马数字", () => {
    expect(normalizeEmission("国四")).toBe("国 IV");
    expect(normalizeEmission("国4")).toBe("国 IV");
    expect(normalizeEmission("国Ⅵ")).toBe("国 VI");
    expect(normalizeEmission("欧五")).toBe("欧 V");
  });

  it("车价单位换算成分", () => {
    expect(parsePriceFen("13.69万")).toBe(13690000);
    expect(parsePriceFen("136900")).toBe(13690000);
    expect(parsePriceFen("13.69")).toBe(13690000);
    expect(parsePriceFen("-")).toBeNull();
  });
});

describe("极速车服渠道", () => {
  it("把渠道字段映射成统一车型档案", async () => {
    vi.stubEnv("JISUEPC_APPKEY", "test-appkey");
    stubFetch(SAMPLE_PAYLOAD);

    const result = await jisuepcProvider.query(SAMPLE_VIN, {
      signal: new AbortController().signal,
      timeoutMs: 3000,
    });

    expect(result.spec.brand).toBe("斯柯达");
    expect(result.spec.seriesName).toBe("明锐");
    expect(result.spec.modelYear).toBe(2009);
    expect(result.spec.curbWeightKg).toBe(1318);
    expect(result.spec.displacementMl).toBe(1598);
    expect(result.spec.emissionStandard).toBe("国 IV");
    expect(result.spec.energyType).toBe("gasoline");
    expect(result.spec.vehicleClass).toBe("sedan");
    expect(result.spec.newCarPriceFen).toBe(13690000);
    expect(result.spec.isCommercial).toBe(false);
    expect(result.spec.missingFields).not.toContain("整备质量");
  });

  it("210 没有信息 → NOT_FOUND", async () => {
    vi.stubEnv("JISUEPC_APPKEY", "test-appkey");
    stubFetch({ status: "210", msg: "没有信息", result: "" });

    await expect(
      jisuepcProvider.query("LSVAA49J1C2345678", {
        signal: new AbortController().signal,
        timeoutMs: 3000,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", upstreamCode: "210" });
  });

  it("101 APPKEY 不存在 → UNAUTHORIZED", async () => {
    vi.stubEnv("JISUEPC_APPKEY", "bad");
    stubFetch({ status: "101", msg: "APPKEY不存在", result: "" });

    await expect(
      jisuepcProvider.query(SAMPLE_VIN, {
        signal: new AbortController().signal,
        timeoutMs: 3000,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", retryable: true });
  });

  it("未配置 APPKEY 时不发请求", async () => {
    vi.stubEnv("JISUEPC_APPKEY", "");
    const spy = stubFetch(SAMPLE_PAYLOAD);

    await expect(
      jisuepcProvider.query(SAMPLE_VIN, {
        signal: new AbortController().signal,
        timeoutMs: 3000,
      }),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(spy).not.toHaveBeenCalled();
  });
});

function fakeProvider(
  id: string,
  behaviour: "ok" | "miss" | "quota",
): VinProvider {
  return {
    id,
    label: `渠道-${id}`,
    costFenPerQuery: 5,
    isConfigured: () => true,
    async query(vin) {
      if (behaviour === "miss") {
        throw new VinQueryError({
          code: "NOT_FOUND",
          message: "没有信息",
          providerId: id,
          providerLabel: `渠道-${id}`,
          retryable: true,
        });
      }
      if (behaviour === "quota") {
        throw new VinQueryError({
          code: "QUOTA_EXCEEDED",
          message: "余额不足",
          providerId: id,
          providerLabel: `渠道-${id}`,
        });
      }
      return {
        spec: {
          vin,
          brand: "测试品牌",
          manufacturer: "测试厂家",
          modelName: "测试车型 2020款",
          seriesName: "测试车型",
          modelYear: 2020,
          vinYear: 2020,
          vehicleClass: "sedan",
          bodyType: "三厢车",
          sizeType: "紧凑型车",
          displacementMl: 1498,
          fuelType: "汽油",
          energyType: "gasoline",
          emissionStandard: "国 VI",
          curbWeightKg: 1300,
          seats: 5,
          gearbox: "CVT",
          driveMode: "前置前驱",
          newCarPriceFen: 1200000,
          isCommercial: false,
          isImport: false,
          missingFields: [],
          fetchedAt: NOW.toISOString(),
        },
        raw: {},
      };
    },
  };
}

describe("真实渠道联调", () => {
  const live = process.env.VIN_LIVE === "1" ? it : it.skip;

  live(
    "VIN_LIVE=1 时直连极速车服验证真实车型",
    async () => {
      const outcome = await queryVin(SAMPLE_VIN, { allowCache: false, log: false });
      expect(outcome.spec.brand).toBeTruthy();
      expect(outcome.spec.curbWeightKg).toBeGreaterThan(500);
      expect(outcome.spec.vin).toBe(SAMPLE_VIN);
    },
    20000,
  );
});

describe("多渠道路由", () => {
  it("首个渠道额度用尽时自动切到下一个渠道", async () => {
    registerVinProvider(fakeProvider("test-quota", "quota"));
    registerVinProvider(fakeProvider("test-ok", "ok"));
    vi.stubEnv("VIN_PROVIDER_ORDER", "test-quota,test-ok");

    const outcome = await queryVin(SAMPLE_VIN, {
      allowCache: false,
      log: false,
    });

    expect(outcome.providerId).toBe("test-ok");
    expect(outcome.spec.brand).toBe("测试品牌");
    expect(outcome.attempts.map((attempt) => attempt.code)).toEqual([
      "QUOTA_EXCEEDED",
      null,
    ]);
  });

  it("全部渠道无结果时返回 NOT_FOUND", async () => {
    registerVinProvider(fakeProvider("test-miss-a", "miss"));
    registerVinProvider(fakeProvider("test-miss-b", "miss"));
    vi.stubEnv("VIN_PROVIDER_ORDER", "test-miss-a,test-miss-b");

    await expect(
      queryVin(SAMPLE_VIN, { allowCache: false, log: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("渠道列表可读，未配置的渠道不参与路由", () => {
    vi.stubEnv("JISUEPC_APPKEY", "");
    const providers = listVinProviders();
    const jisuepc = providers.find((provider) => provider.id === "jisuepc");
    expect(jisuepc).toBeDefined();
    expect(jisuepc?.configured).toBe(false);
  });
});

describe("真实车型档案参与残值测算", () => {
  const spec = {
    vin: SAMPLE_VIN,
    brand: "斯柯达",
    manufacturer: "上汽大众斯柯达",
    modelName: "明锐 2009款 1.6L 自动逸致版",
    seriesName: "明锐",
    modelYear: 2009,
    vinYear: 2008,
    vehicleClass: "sedan" as const,
    bodyType: "掀背车",
    sizeType: "紧凑型车",
    displacementMl: 1598,
    fuelType: "汽油",
    energyType: "gasoline" as const,
    emissionStandard: "国 IV",
    curbWeightKg: 1318,
    seats: 5,
    gearbox: "6挡手自一体",
    driveMode: "前置前驱",
    newCarPriceFen: 13690000,
    isCommercial: false,
    isImport: false,
    missingFields: [],
    providerId: "jisuepc",
    providerLabel: "极速车服",
    fetchedAt: NOW.toISOString(),
    latencyMs: 100,
    cached: false,
  };

  it("用实车整备质量与品牌型号出报告，并标为渠道数据", () => {
    const report = buildValuationReport({
      seed: "a".repeat(64),
      source: "vin",
      vin: SAMPLE_VIN,
      spec,
      now: NOW,
    });

    expect(report.dataSource.kind).toBe("provider");
    expect(report.dataSource.providerLabel).toBe("极速车服");
    expect(report.profile.brandModel).toContain("斯柯达");
    expect(report.profile.brandModel).toContain("明锐");
    expect(report.profile.curbWeightKg).toBe(1318);
    expect(report.profile.emission).toBe("国 IV");
    expect(report.ageYears).toBeGreaterThan(17);
    expect(report.estimatedFields).not.toContain("整备质量");
    expect(report.estimatedFields).toContain("使用性质");
    expect(report.items).toHaveLength(6);
    expect(report.netLowFen).toBeLessThan(report.netMidFen);
  });

  it("降级提示透传到报告", () => {
    const report = buildValuationReport({
      seed: "b".repeat(64),
      source: "vin",
      vin: SAMPLE_VIN,
      spec: null,
      notice: "VIN 查询渠道暂时不可用，已按规则引擎给出推定结果。",
      now: NOW,
    });

    expect(report.dataSource.kind).toBe("demo");
    expect(report.dataSource.notice).toContain("渠道暂时不可用");
  });
});