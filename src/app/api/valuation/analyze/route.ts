import { NextResponse } from "next/server";
import { recordVinSearch } from "@/lib/analytics/log";
import { explainVinError, queryVin } from "@/lib/vin";
import { validateVin } from "@/lib/vin/normalize";
import {
  DEFAULT_QUOTE_OPTIONS,
  computeQuote,
  type ValuationDataSource,
  type VehicleProfile,
  type VinQuoteReport,
} from "@/lib/valuation/pricing";
import { checkVinRateLimit, clientIp } from "@/lib/security/rate-limit";
import { getActivePricing } from "@/lib/valuation/pricing-store";
import { buildProfileFromSpec } from "@/lib/valuation/profile";

const PHOTO_DISABLED_MESSAGE = "已停止照片识别，请填写 17 位 VIN";

function fail(error: string, status: number, code?: string) {
  return NextResponse.json(
    { ok: false, error, ...(code ? { code } : {}) },
    { status },
  );
}

function manualPricingHint(): string {
  return "如确认 VIN 无误，可电话联系 158 2899 6681。";
}

/**
 * 公开报价入口：只接受 JSON `{ vin }`。
 *
 * 车型档案必须来自第三方渠道；渠道无结果/不可用时明确报错，
 * 不用 WMI / 预设车型兜底编造品牌与重量。
 */
export async function POST(request: Request) {
  const rate = checkVinRateLimit(clientIp(request));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "请求过于频繁，请稍后再试。",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

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
      await recordVinSearch({
        vin,
        isDemo: false,
        status: "not_found",
        errorCode: explained.code,
      });
      return fail(
        `没有查到该 VIN 对应的车型信息，请核对 VIN 后重试。${manualPricingHint()}`,
        404,
        explained.code,
      );
    }
    if (explained.code === "QUOTA_EXCEEDED" || explained.code === "MAINTENANCE") {
      return fail(explained.message, 503, explained.code);
    }
    if (explained.code === "RATE_LIMITED") {
      return fail(explained.message, 429, explained.code);
    }
    await recordVinSearch({
      vin,
      isDemo: false,
      status: "error",
      errorCode: explained.code,
    });
    return fail(
      `车型档案查询暂时不可用，请稍后重试。${manualPricingHint()}`,
      502,
      explained.code,
    );
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
    demo: false,
  };

  await recordVinSearch({
    vin,
    isDemo: report.demo,
    status: "ok",
    brandModel: vehicle.brandModel,
    vehicleType: vehicle.vehicleType,
    provider: dataSource.providerId,
    pricingVersion: active.version,
    quoteLowFen: quote.range?.lowFen ?? null,
    quoteMidFen: quote.range?.midFen ?? null,
    quoteHighFen: quote.range?.highFen ?? null,
    quoteNetFen: quote.netFen,
  });

  return NextResponse.json({ ok: true, report });
}