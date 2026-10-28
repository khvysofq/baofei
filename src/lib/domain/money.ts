/**
 * 金额一律以整数分计算与存储。
 * 未知费用用 null 表示，绝不按 0 处理。
 */

export type Fen = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertNonNegativeFen(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${name} 必须是有限数字`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${name} 必须是以分为单位的整数`);
  }
  if (value < 0) {
    throw new MoneyError(`${name} 不能为负数`);
  }
  return value;
}

/** 元 → 分。空值、负数、非数字一律拒绝。未知请使用 toFenOrNull。 */
export function yuanToFen(yuan: number | string): Fen {
  if (yuan === null || yuan === undefined || yuan === "") {
    throw new MoneyError("金额不能为空");
  }
  const n = typeof yuan === "string" ? Number(yuan.trim()) : yuan;
  if (!Number.isFinite(n)) {
    throw new MoneyError("金额不是有效数字");
  }
  if (n < 0) {
    throw new MoneyError("金额不能为负数");
  }
  const fen = Math.round(n * 100);
  if (!Number.isSafeInteger(fen)) {
    throw new MoneyError("金额超出可安全计算范围");
  }
  return fen;
}

/** 可选费用：缺省/空字符串视为未知，返回 null；其余走 yuanToFen 校验。 */
export function toFenOrNull(
  yuan: number | string | null | undefined,
): Fen | null {
  if (yuan === null || yuan === undefined || yuan === "") return null;
  return yuanToFen(yuan);
}

/** 分 → 元（数值）。 */
export function fenToYuan(fen: number): number {
  assertNonNegativeFen(fen, "金额");
  return fen / 100;
}

/** 分 → 展示字符串，例如 105000 → "1,050"，105050 → "1,050.50"。 */
export function formatYuan(fen: number | null): string {
  if (fen === null) return "待确认";
  assertNonNegativeFen(fen, "金额");
  const yuan = fen / 100;
  const hasFraction = fen % 100 !== 0;
  return yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export type FeeBreakdown = {
  grossFen: number | null;
  towFen: number | null;
  serviceFen: number | null;
};

/**
 * 预计实收 = 回收款 - 拖车费 - 服务费。
 * 任一费用未知 → 净额 null（界面显示“待确认”）。
 * 已知金额中出现负数、非整数或净额为负 → 抛错，避免静默掩盖异常。
 */
export function calcNetFen(fees: FeeBreakdown): Fen | null {
  const { grossFen, towFen, serviceFen } = fees;
  if (grossFen === null || towFen === null || serviceFen === null) {
    return null;
  }
  const gross = assertNonNegativeFen(grossFen, "回收款");
  const tow = assertNonNegativeFen(towFen, "拖车费");
  const service = assertNonNegativeFen(serviceFen, "服务费");
  const net = gross - tow - service;
  if (net < 0) {
    throw new MoneyError("预计实收不能为负数");
  }
  return net;
}

export function sumKnownFen(fens: Array<number | null>): number | null {
  if (fens.some((f) => f === null)) return null;
  return fens.reduce<number>((acc, f) => acc + (f as number), 0);
}