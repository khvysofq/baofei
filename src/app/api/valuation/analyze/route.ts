import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { buildValuationReport } from "@/lib/valuation/engine";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/svg+xml"];

/**
 * 行驶证上传 → 残值报告。样例版只在内存中读取文件摘要，不落盘、不入库、不上传对象存储。
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不正确，请重新上传。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "没有收到行驶证照片。" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "照片内容为空，请重新选择。" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "照片超过 10MB，请压缩后重试。" }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: "仅支持 JPG / PNG / WebP / HEIC 格式的照片。" },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const seed = createHash("sha256").update(buffer).digest("hex");
  const sample = form.get("sample") === "1";
  const report = buildValuationReport({ seed, sample });

  return NextResponse.json({ ok: true, report });
}