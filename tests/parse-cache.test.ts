import { describe, expect, it } from "vitest";
import { parseIntakeCached } from "@/lib/services/parse";

describe("解析缓存", () => {
  it("同一输入第二次从 Valkey 返回，并标 source=cache", async () => {
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const text = `车在成都，登记在成都，本人办理，开不动了，只想报废，不买新车。临时编号 ${nonce}`;
    const first = await parseIntakeCached(text);
    const second = await parseIntakeCached(text);
    expect(first.source).toBe("rule");
    expect(second.source).toBe("cache");
    expect(second.fields.intent.value).toBe("scrap");
    expect(second.fields.vehicleLocation.value).toEqual({
      province: "四川",
      city: "成都",
    });
  });
});