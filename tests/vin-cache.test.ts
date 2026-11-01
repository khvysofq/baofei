import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  setCalls: [] as { key: string; ttl: number }[],
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: async (key: string) => h.store.get(key) ?? null,
  cacheSet: async (key: string, value: string, ttl: number) => {
    h.store.set(key, value);
    h.setCalls.push({ key, ttl });
    return true;
  },
  cacheDelete: async (key: string) => {
    h.store.delete(key);
  },
  cacheDeleteByPrefix: async () => {
    h.store.clear();
  },
}));

import { buildValuationReport } from "@/lib/valuation/engine";
import { queryVin, registerVinProvider } from "@/lib/vin";
import { computeVinCheckDigit } from "@/lib/vin/normalize";
import { VinQueryError, type VinProvider } from "@/lib/vin/types";

const BASE_VIN = "LSVAL41Z882104202";

/** 用国标算法把任意序列补成合法 VIN。 */
function withCheckDigit(base: string): string {
  const candidate = `${base.slice(0, 8)}0${base.slice(9)}`;
  const digit = computeVinCheckDigit(candidate);
  if (!digit) throw new Error("无法计算校验位");
  return `${base.slice(0, 8)}${digit}${base.slice(9)}`;
}

const VIN_2 = withCheckDigit("LSVAL41Z882104203");
const VIN_3 = withCheckDigit("LSVAL41Z882104204");

const SPEC = {
  vin: BASE_VIN,
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
  fetchedAt: "2026-11-01T00:00:00.000Z",
};

function countingProvider(id: string, behaviour: "ok" | "miss" = "ok") {
  let calls = 0;
  const provider: VinProvider = {
    id,
    label: `测试渠道-${id}`,
    costFenPerQuery: 5,
    isConfigured: () => true,
    async query(vin) {
      calls += 1;
      if (behaviour === "miss") {
        throw new VinQueryError({
          code: "NOT_FOUND",
          message: "没有信息",
          providerId: id,
          providerLabel: `测试渠道-${id}`,
        });
      }
      return { spec: { ...SPEC, vin }, raw: {} };
    },
  };
  return { provider, calls: () => calls };
}

beforeEach(() => {
  h.store.clear();
  h.setCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("VIN 查询缓存", () => {
  it("同一 VIN 命中缓存后不再调用渠道，TTL 为 30 天", async () => {
    const { provider, calls } = countingProvider("cache-hit", "ok");
    registerVinProvider(provider);
    vi.stubEnv("VIN_PROVIDER_ORDER", "cache-hit");

    const first = await queryVin(BASE_VIN, { log: false });
    const second = await queryVin(BASE_VIN, { log: false });

    expect(calls()).toBe(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.spec.curbWeightKg).toBe(first.spec.curbWeightKg);
    expect(second.spec.vin).toBe(BASE_VIN);

    const specWrite = h.setCalls.find((call) => call.key.includes(":spec:cache-hit:"));
    expect(specWrite?.ttl).toBe(30 * 24 * 60 * 60);

    vi.unstubAllEnvs();
  });

  it("残值报告每次重算：同一份缓存车型，不同日期编号与有效期不同", async () => {
    const { provider } = countingProvider("cache-report", "ok");
    registerVinProvider(provider);
    vi.stubEnv("VIN_PROVIDER_ORDER", "cache-report");

    const outcome = await queryVin(BASE_VIN, { log: false });
    const day1 = buildValuationReport({
      seed: "a".repeat(64),
      source: "vin",
      vin: BASE_VIN,
      spec: outcome.spec,
      now: new Date("2026-11-01T08:00:00Z"),
    });
    const day2 = buildValuationReport({
      seed: "a".repeat(64),
      source: "vin",
      vin: BASE_VIN,
      spec: outcome.spec,
      now: new Date("2026-11-02T08:00:00Z"),
    });

    expect(day2.reportNo).not.toBe(day1.reportNo);
    expect(day2.validUntil).not.toBe(day1.validUntil);
    // 车型档案来自同一次缓存，获取时间不变
    expect(day2.dataSource.fetchedAt).toBe(day1.dataSource.fetchedAt);
    expect(day2.dataSource.kind).toBe("provider");

    vi.unstubAllEnvs();
  });

  it("渠道无结果时写入负缓存，短时间内不重复扣费", async () => {
    const { provider, calls } = countingProvider("cache-miss", "miss");
    registerVinProvider(provider);
    vi.stubEnv("VIN_PROVIDER_ORDER", "cache-miss");

    await expect(queryVin(VIN_2, { log: false })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(queryVin(VIN_2, { log: false })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(calls()).toBe(1);
    const negativeWrite = h.setCalls.find((call) => call.key.includes(":miss:"));
    expect(negativeWrite?.ttl).toBe(10 * 60);

    vi.unstubAllEnvs();
  });

  it("并发查询同一个 VIN 只打一次渠道", async () => {
    let calls = 0;
    registerVinProvider({
      id: "cache-inflight",
      label: "测试渠道-并发",
      costFenPerQuery: 5,
      isConfigured: () => true,
      async query(vin) {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { spec: { ...SPEC, vin }, raw: {} };
      },
    });
    vi.stubEnv("VIN_PROVIDER_ORDER", "cache-inflight");

    const [a, b] = await Promise.all([
      queryVin(VIN_3, { log: false }),
      queryVin(VIN_3, { log: false }),
    ]);

    expect(calls).toBe(1);
    expect(a.spec.vin).toBe(VIN_3);
    expect(b.spec.vin).toBe(VIN_3);

    vi.unstubAllEnvs();
  });
});

describe("VIN 校验先于渠道调用", () => {
  it("校验位错误直接失败，不调用渠道也不写缓存", async () => {
    const { provider, calls } = countingProvider("cache-invalid", "ok");
    registerVinProvider(provider);
    vi.stubEnv("VIN_PROVIDER_ORDER", "cache-invalid");

    await expect(
      queryVin("LSVAA49J1C2345678", { log: false }),
    ).rejects.toMatchObject({ code: "INVALID_VIN" });

    expect(calls()).toBe(0);
    expect(h.setCalls).toHaveLength(0);

    vi.unstubAllEnvs();
  });
});