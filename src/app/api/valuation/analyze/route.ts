import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { buildValuationReport, isValidVin, normalizeVin } from "@/lib/valuation/engine";
import { explainVinError, queryVin } from "@/lib/vin";
import type { VinVehicleSpec } from "@/lib/vin/types";

const MAX_BYTES = 10 * 1024 * 1024;
/** 首页「填入示例 VIN」使用的演示车架号；跳过第三方渠道，保证样例始终可用。 */
const DEMO_VIN = "LSVAA49J1C2345678";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/svg+xml"];

function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * 残值评估入口，两种输入：
 * 1. JSON `{ vin }`：手动填写 17 位车辆识别代号。
 * 2. multipart `file`：上传行驶证正面照片（样例版不落盘，只在内存中取摘要）。
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let payload: { vin?: unknown };
    try {
      payload = (await request.json()) as { vin?: unknown };
    } catch {
      return badRequest("请求格式不正确，请重新提交。");
    }
    if (typeof payload.vin !== "string" || !payload.vin.trim()) {
      return badRequest("请填写车辆识别代号（VIN）。");
    }
    const vin = normalizeVin(payload.vin);
    if (!isValidVin(vin)) {
      return badRequest("VIN 应为 17 位数字或字母，且不含 I、O、Q。");
    }

    // 真实 VIN 渠道优先；渠道无结果时明确告知，渠道故障时降级为演示推定并标注原因。
    let spec: VinVehicleSpec | null = null;
    let notice: string | null = null;
    if (vin === DEMO_VIN) {
      notice = "示例 VIN：使用内置演示车型推算，可直接体验完整报告。";
    } else {
      try {
        const outcome = await queryVin(vin);
        spec = outcome.spec;
      } catch (caught) {
        const explained = explainVinError(caught);
        if (!explained.shouldFallbackToDemo) {
          const status = explained.code === "INVALID_VIN" ? 400 : 404;
          return NextResponse.json(
            { ok: false, error: explained.message, code: explained.code },
            { status },
          );
        }
        notice = explained.message;
        console.warn(
          `[vin] ${vin} 渠道查询失败，降级演示推定：${explained.code} ${explained.message}`,
        );
      }
    }

    const report = buildValuationReport({
      seed: createHash("sha256").update(`vin:${vin}`).digest("hex"),
      source: "vin",
      vin,
      spec,
      notice,
    });
    return NextResponse.json({ ok: true, report });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("请求格式不正确，请重新上传。");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("没有收到行驶证照片。");
  }
  if (file.size === 0) {
    return badRequest("照片内容为空，请重新选择。");
  }
  if (file.size > MAX_BYTES) {
    return badRequest("照片超过 10MB，请压缩后重试。", 413);
  }
  if (!ALLOWED.includes(file.type)) {
    return badRequest("仅支持 JPG / PNG / WebP / HEIC 格式的照片。", 415);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const seed = createHash("sha256").update(buffer).digest("hex");
  const sample = form.get("sample") === "1";
  const report = buildValuationReport({ seed, sample, source: "license" });

  return NextResponse.json({ ok: true, report });
}