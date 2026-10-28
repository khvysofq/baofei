import { describe, expect, it } from "vitest";
import {
  appointmentNeedsReconfirmation,
  isQuoteStale,
  missingDocResolutionValid,
  nextVersion,
  touchedProfile,
} from "@/lib/domain/versions";

describe("版本失效", () => {
  it("报价版本落后视为过期", () => {
    expect(isQuoteStale(1, 2)).toBe(true);
    expect(isQuoteStale(2, 2)).toBe(false);
    expect(isQuoteStale(null, 1)).toBe(true);
  });

  it("profileVersion / materialsVersion 变化使预约需重新确认", () => {
    const appointment = {
      status: "booked" as const,
      quoteVersion: 1,
      profileVersion: 1,
      materialsVersion: 1,
    };
    expect(
      appointmentNeedsReconfirmation(appointment, {
        activeQuoteVersion: 1,
        profileVersion: 1,
        materialsVersion: 1,
      }),
    ).toBe(false);
    expect(
      appointmentNeedsReconfirmation(appointment, {
        activeQuoteVersion: 1,
        profileVersion: 2,
        materialsVersion: 1,
      }),
    ).toBe(true);
    expect(
      appointmentNeedsReconfirmation(appointment, {
        activeQuoteVersion: 1,
        profileVersion: 1,
        materialsVersion: 2,
      }),
    ).toBe(true);
  });

  it("缺证解决说明绑定版本与地区，地区变化后失效", () => {
    const resolution = {
      profileVersion: 1,
      materialsVersion: 2,
      vehicleCity: "成都",
      registrationCity: "成都",
    };
    expect(
      missingDocResolutionValid(resolution, {
        profileVersion: 1,
        materialsVersion: 2,
        vehicleCity: "成都",
        registrationCity: "成都",
      }),
    ).toBe(true);
    expect(
      missingDocResolutionValid(resolution, {
        profileVersion: 1,
        materialsVersion: 2,
        vehicleCity: "成都",
        registrationCity: "绵阳",
      }),
    ).toBe(false);
  });

  it("仅影响补贴的字段不触发 profile 版本", () => {
    expect(touchedProfile("intent", "scrap", "replace")).toBe(false);
    expect(touchedProfile("drivable", false, true)).toBe(true);
    expect(nextVersion(3)).toBe(4);
  });
});