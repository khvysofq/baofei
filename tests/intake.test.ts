import { describe, expect, it } from "vitest";
import { parseIntake } from "@/lib/rules/intake";

describe("确定性分诊", () => {
  it("A01：S1 含“不买新车”识别为仅报废", () => {
    const r = parseIntake(
      "车现在在成都，登记也是成都，本人办理，车子开不动了，行驶证和登记证都在，只想报废，不买新车。",
    );
    expect(r.fields.intent.value).toBe("scrap");
    expect(r.fields.ownerRelation.value).toBe("self");
    expect(r.fields.drivable.value).toBe(false);
    expect(r.fields.documentsStatus.value).toBe("complete");
    expect(r.fields.vehicleLocation.value).toEqual({ province: "四川", city: "成都" });
  });

  it("A02：未说明登记地保留 unknown", () => {
    const r = parseIntake("车在成都，开不动了，想报废。");
    expect(r.fields.vehicleLocation.value).toEqual({ province: "四川", city: "成都" });
    expect(r.fields.registrationLocation.value).toBeNull();
    expect(r.fields.documentsStatus.value).toBeNull();
    expect(r.options.some((o) => o.field === "registrationLocation")).toBe(true);
  });

  it("A19：只说车在四川时不补成都", () => {
    const r = parseIntake("车在四川，绿本不见了。");
    expect(r.fields.vehicleLocation.value).toEqual({ province: "四川", city: null });
    expect(r.fields.documentsStatus.value).toBe("missing_registration");
    expect(r.fields.registrationLocation.value).toBeNull();
  });

  it("A20：成都所在地 + 绵阳 / 重庆登记地", () => {
    const mianyang = parseIntake("车现在成都，登记在绵阳，开不动了。");
    expect(mianyang.fields.vehicleLocation.value).toEqual({ province: "四川", city: "成都" });
    expect(mianyang.fields.registrationLocation.value).toEqual({
      province: "四川",
      city: "绵阳",
    });
    const chongqing = parseIntake("车在成都，是重庆登记的，想报废。");
    expect(chongqing.fields.registrationLocation.value).toEqual({
      province: "重庆",
      city: "重庆",
    });
    const local = parseIntake("车在成都，登记在成都市，只想报废。");
    expect(local.fields.registrationLocation.value).toEqual({
      province: "四川",
      city: "成都",
    });
  });

  it("报废并换新识别，且不因“不买新车”旁路", () => {
    const replace = parseIntake(
      "车在成都，登记在成都，本人办理，开不动，证件齐全，准备报废后买辆新车。",
    );
    expect(replace.fields.intent.value).toBe("replace");
    const scrap = parseIntake("车在成都，准备报废，不买新车。");
    expect(scrap.fields.intent.value).toBe("scrap");
  });

  it("家人代办识别", () => {
    const r = parseIntake("帮我爸办理，车在成都，登记在成都，证件齐全。");
    expect(r.fields.ownerRelation.value).toBe("family");
  });

  it("与已确认字段冲突时不静默覆盖", () => {
    const r = parseIntake("车现在在绵阳，登记在成都，只想报废。", {
      vehicleLocation: {
        value: { province: "四川", city: "成都" },
        confirmed: true,
        source: "user",
      },
    });
    expect(r.fields.vehicleLocation.value).toEqual({ province: "四川", city: "成都" });
    expect(r.conflicts[0]?.field).toBe("vehicleLocation");
    expect(r.conflicts[0]?.candidate).toEqual({ province: "四川", city: "绵阳" });
  });

  it("空输入降级为选项而不是报错", () => {
    const r = parseIntake("   ");
    expect(r.degraded).toBe(true);
    expect(r.options.length).toBeGreaterThan(0);
  });
});