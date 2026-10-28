import { describe, expect, it } from "vitest";
import {
  calcNetFen,
  fenToYuan,
  formatYuan,
  MoneyError,
  toFenOrNull,
  yuanToFen,
} from "@/lib/domain/money";

describe("金额（整数分）", () => {
  it("元与分互转", () => {
    expect(yuanToFen(1200)).toBe(120000);
    expect(yuanToFen("1050.50")).toBe(105050);
    expect(fenToYuan(105000)).toBe(1050);
    expect(formatYuan(105000)).toBe("1,050");
    expect(formatYuan(105050)).toBe("1,050.50");
  });

  it("负数、空值、非数字一律拒绝", () => {
    expect(() => yuanToFen(-1)).toThrow(MoneyError);
    expect(() => yuanToFen("")).toThrow(MoneyError);
    expect(() => yuanToFen("abc")).toThrow(MoneyError);
    expect(() => calcNetFen({ grossFen: -1, towFen: 0, serviceFen: 0 })).toThrow(
      MoneyError,
    );
  });

  it("未知费用返回 null，不能当 0", () => {
    expect(toFenOrNull(null)).toBeNull();
    expect(toFenOrNull(undefined)).toBeNull();
    expect(toFenOrNull("")).toBeNull();
    expect(toFenOrNull(0)).toBe(0);
    expect(calcNetFen({ grossFen: 120000, towFen: null, serviceFen: 0 })).toBeNull();
    expect(formatYuan(null)).toBe("待确认");
  });

  it("报价净额：A 1000 元，B 1050 元", () => {
    expect(
      calcNetFen({ grossFen: 120000, towFen: 20000, serviceFen: 0 }),
    ).toBe(100000);
    expect(
      calcNetFen({ grossFen: 110000, towFen: 0, serviceFen: 5000 }),
    ).toBe(105000);
  });

  it("预计实收为负时抛错", () => {
    expect(() =>
      calcNetFen({ grossFen: 10000, towFen: 20000, serviceFen: 0 }),
    ).toThrow(MoneyError);
  });
});