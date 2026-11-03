import { NextResponse } from "next/server";
import {
  ADMIN_SETUP_HINT,
  adminConfigured,
  isAdminAuthenticated,
} from "@/lib/admin/auth";
import {
  PricingConfigError,
  getActivePricing,
  listPricingHistory,
  savePricing,
} from "@/lib/valuation/pricing-store";

async function guard(): Promise<NextResponse | null> {
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, ...ADMIN_SETUP_HINT }, { status: 503 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;

  const active = await getActivePricing();
  let history: Awaited<ReturnType<typeof listPricingHistory>> = [];
  let historyError: string | null = null;
  try {
    history = await listPricingHistory(30);
  } catch {
    historyError = "版本历史暂时读取失败。";
  }

  return NextResponse.json({
    ok: true,
    active: {
      version: active.version,
      config: active.config,
      updatedAt: active.updatedAt,
      fallback: active.fallback,
      fallbackReason: active.fallbackReason,
    },
    history,
    historyError,
  });
}

export async function PUT(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不正确。" }, { status: 400 });
  }

  const raw =
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    "config" in payload
      ? (payload as { config: unknown }).config
      : payload;

  try {
    const saved = await savePricing(raw);
    return NextResponse.json({
      ok: true,
      version: saved.version,
      config: saved.config,
      createdAt: saved.createdAt,
    });
  } catch (caught) {
    if (caught instanceof PricingConfigError) {
      return NextResponse.json(
        { ok: false, error: "定价配置校验未通过。", errors: caught.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "定价配置保存失败，请检查数据库后重试。" },
      { status: 500 },
    );
  }
}