import { NextResponse } from "next/server";
import { explainVinError, queryVin } from "@/lib/vin";
import { validateVin } from "@/lib/vin/normalize";
import {
  DEFAULT_QUOTE_OPTIONS,
  computeQuote,
  type ValuationDataSource,
  type VehicleProfile,
  type VinQuoteReport,
} from "@/lib/valuation/pricing";
import { getActivePricing } from "@/lib/valuation/pricing-store";
import {
  DEMO_VIN,
  buildDemoVehicleProfile,
  buildProfileFromSpec,
} from "@/lib/valuation/profile";

const PHOTO_DISABLED_MESSAGE = "已停止照片识别，请填写 17 位 VIN";

function fail(error: string, status: number, code?: string) {
  return NextResponse.json(
    { ok: false, error, ...(code ? { code } : {}) },
    { status },
  );
}

function manualPricingHint(): string {
  return "如确认 VIN 无误，可电话联系人工按吨计价。";
}

/**
 * 公开报价入口：只接受 JSON `{ vin }`。
 *
 * 车型档案必须来自第三方渠道或内置示例 VIN；渠道无结果/不可用时明确报错，
 * 不再用 WMI / 预设车型兜底编造品牌与重量。
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (contentType.includes("multipart/form-data")) {
      return fail(PHOTO_DISABLED_MESSAGE, 415, "PHOTO_NOT_SUPPORTED");
    }
    return fail("请以 JSON 提交 17 位 VIN。", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  let payload: { vin?: unknown };
  try {
    payload = (await request.json()) as { vin?: unknown };
  } catch {
    return fail("请求格式不正确，请重新提交。", 400, "BAD_JSON");
  }

  if (typeof payload.vin !== "string" || !payload.vin.trim()) {
    return fail("请填写车辆识别代号（VIN）。", 400, "VIN_REQUIRED");
  }

  const validation = validateVin(payload.vin, {
    checkDigit: process.env.VIN_CHECK_DIGIT !== "off",
  });
  if (!validation.ok) {
    return fail(validation.message, 400, validation.code ?? "INVALID_VIN");
  }
  const vin = validation.vin;

  let vehicle: VehicleProfile;
  let dataSource: ValuationDataSource;

  if (vin === DEMO_VIN) {
    vehicle = buildDemoVehicleProfile(vin);
    dataSource = {
      kind: "demo",
      providerId: "demo",
      providerLabel: "内置演示车型",
      cached: false,
      fetchedAt: new Date().toISOString(),
      notice: "示例 VIN：使用内置演示车型体验报告；真实报价请填写实际 VIN。",
    };
  } else {
    try {
      const outcome = await queryVin(vin);
      vehicle = buildProfileFromSpec(outcome.spec, vin);
      dataSource = {
        kind: "provider",
        providerId: outcome.spec.providerId,
        providerLabel: outcome.spec.providerLabel,
        cached: outcome.spec.cached,
        fetchedAt: outcome.spec.fetchedAt,
        notice: null,
      };
    } catch (caught) {
      const explained = explainVinError(caught);
      if (explained.code === "INVALID_VIN") {
        return fail(explained.message, 400, explained.code);
      }
      if (explained.code === "NOT_FOUND") {
        return fail(
          `没有查到该 VIN 对应的车型信息，请核对 VIN 后重试。${manualPricingHint()}`,
          404,
          explained.code,
        );
      }
      return fail(
        `车型档案查询暂时不可用，请稍后重试。${manualPricingHint()}`,
        502,
        explained.code,
      );
    }
  }

  const active = await getActivePricing();
  const quote = computeQuote({
    vehicle,
    pricing: active.config,
    options: DEFAULT_QUOTE_OPTIONS,
  });

  const report: VinQuoteReport = {
    vehicle,
    pricing: active.config,
    quote,
    dataSource,
    pricedAt: new Date().toISOString(),
    pricingVersion: active.version,
    demo: vin === DEMO_VIN,
  };

  return NextResponse.json({ ok: true, report });
}