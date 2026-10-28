import { describe, expect, it } from "vitest";
import {
  classifyLocations,
  isRegionUnknown,
  normalizeRegion,
  regionLabel,
} from "@/lib/domain/regions";

describe("地区归一化", () => {
  it("成都 / 成都市视为同一地", () => {
    expect(normalizeRegion("成都")).toEqual({ province: "四川", city: "成都" });
    expect(normalizeRegion("成都市")).toEqual({ province: "四川", city: "成都" });
    expect(classifyLocations(normalizeRegion("成都"), normalizeRegion("成都市"))).toBe(
      "same_city",
    );
    expect(regionLabel(normalizeRegion("成都市"))).toBe("四川·成都");
  });

  it("只有四川时市州保持 unknown，不补成都", () => {
    const region = normalizeRegion("四川");
    expect(region).toEqual({ province: "四川", city: null });
    expect(isRegionUnknown(region)).toBe(false);
    expect(region.city).not.toBe("成都");
    expect(regionLabel(region)).toBe("四川·市州待确认");
  });

  it("省内跨市州与跨省分类", () => {
    expect(
      classifyLocations(normalizeRegion("成都"), normalizeRegion("绵阳")),
    ).toBe("same_province");
    expect(
      classifyLocations(normalizeRegion("成都"), normalizeRegion("重庆")),
    ).toBe("cross_province");
  });

  it("登记地与所在地未知不猜", () => {
    expect(classifyLocations(normalizeRegion("成都"), null)).toBe("unknown");
    expect(classifyLocations({ province: "四川", city: null }, normalizeRegion("成都"))).toBe(
      "unknown",
    );
  });
});