import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const SAMPLE_IDS = ["DOC_CLEAR", "DOC_BLUR", "DOC_MISMATCH"] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

const BUCKET = process.env.S3_BUCKET || "baofei";

let client: S3Client | null = null;

function getS3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "garage",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return client;
}

export function sampleAssetKey(sampleId: string): string {
  return `demo-sc-v1.1/samples/v2/${sampleId}.svg`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 只使用 CSS/SVG 绘制的“演示行驶证/登记证”卡面，不含任何真实证件信息。
 * DOC_BLUR 对登记日期与 VIN 区域做高斯模糊；DOC_MISMATCH 的印刷日期与
 * 提取值固定不一致（本期固定差异，主持人不能临时改难度）。
 */
export function buildSampleSvg(sampleId: SampleId): string {
  const base = {
    plate: "川A·DE0001",
    vehicleNo: "DEMO VEHICLE 01",
    owner: "演示车主",
    regDate: "2014-03-18",
    vin: "LDEMO00000000001",
    useNature: "非营运",
  };
  const title =
    sampleId === "DOC_CLEAR"
      ? "演示资料 1 · 演示车辆证件（行驶证 / 登记证）"
      : sampleId === "DOC_BLUR"
        ? "演示资料 2 · 演示车辆证件（行驶证 / 登记证）"
        : "演示资料 3 · 演示车辆证件（行驶证 / 登记证）";

  const blurDefs =
    sampleId === "DOC_BLUR"
      ? `<filter id="blur"><feGaussianBlur stdDeviation="5.5" /></filter>`
      : "";
  const dateFilter = sampleId === "DOC_BLUR" ? ' filter="url(#blur)"' : "";
  const vinFilter = sampleId === "DOC_BLUR" ? ' filter="url(#blur)"' : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560" role="img" aria-label="演示车辆证件卡面">
  <defs>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12211b"/>
      <stop offset="0.55" stop-color="#0d1714"/>
      <stop offset="1" stop-color="#08100d"/>
    </linearGradient>
    <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.5" fill="#9ba1a3" opacity="0.12"/>
      <circle cx="4" cy="4" r="0.4" fill="#e6e3da" opacity="0.08"/>
    </pattern>
    ${blurDefs}
  </defs>
  <rect width="900" height="560" fill="url(#card)"/>
  <rect width="900" height="560" fill="url(#grain)"/>
  <path d="M0 0 H900 V560 H0 Z" fill="none" stroke="#3c4247" stroke-width="2"/>
  <path d="M28 28 H872 V532 H28 Z" fill="none" stroke="#c9f24d" stroke-opacity="0.35" stroke-width="1"/>
  <text x="56" y="82" fill="#c9f24d" font-family="monospace" font-size="16" letter-spacing="4">DEMO · 演示资料 · 不具法律效力</text>
  <text x="56" y="132" fill="#e6e3da" font-family="sans-serif" font-weight="900" font-size="30">${esc(title)}</text>
  <text x="56" y="166" fill="#9ba1a3" font-family="monospace" font-size="14" letter-spacing="2">${esc(base.vehicleNo)} · SCRAP DEMO SC-V1.1</text>

  <g font-family="monospace" font-size="18" fill="#e6e3da">
    <text x="56" y="230" fill="#9ba1a3" font-size="13" letter-spacing="2">号牌号码</text>
    <text x="56" y="260">${esc(base.plate)}</text>
    <text x="330" y="230" fill="#9ba1a3" font-size="13" letter-spacing="2">所有人</text>
    <text x="330" y="260">${esc(base.owner)}</text>
    <text x="560" y="230" fill="#9ba1a3" font-size="13" letter-spacing="2">使用性质</text>
    <text x="560" y="260">${esc(base.useNature)}</text>

    <text x="56" y="330" fill="#9ba1a3" font-size="13" letter-spacing="2">车辆识别代号（VIN）</text>
    <text x="56" y="360"${vinFilter}>${esc(base.vin)}</text>
    <text x="560" y="330" fill="#9ba1a3" font-size="13" letter-spacing="2">登记日期</text>
    <text x="560" y="360"${dateFilter}>${esc(base.regDate)}</text>

    <text x="56" y="430" fill="#9ba1a3" font-size="13" letter-spacing="2">登记机关（演示占位）</text>
    <text x="56" y="460">四川·成都 演示登记机关</text>
  </g>

  <g>
    <rect x="56" y="490" width="300" height="22" fill="#ff6a1f" opacity="0.16"/>
    <text x="68" y="506" fill="#ff6a1f" font-family="monospace" font-size="12" letter-spacing="3">DEMO ONLY · 样例材料</text>
    <rect x="700" y="492" width="150" height="16" fill="#c9f24d" opacity="${sampleId === "DOC_CLEAR" ? "0.55" : "0.22"}"/>
  </g>
</svg>`;
}

async function ensureBucket(): Promise<void> {
  const s3 = getS3();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch {
      // 桶已存在或无创建权限时继续尝试读写
    }
  }
}

/** 幂等：对象不存在时生成并上传。 */
export async function ensureSampleAsset(sampleId: SampleId): Promise<string> {
  const s3 = getS3();
  const key = sampleAssetKey(sampleId);
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return key;
  } catch {
    await ensureBucket();
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buildSampleSvg(sampleId),
        ContentType: "image/svg+xml; charset=utf-8",
        CacheControl: "public, max-age=3600",
      }),
    );
    return key;
  }
}

export async function ensureAllSampleAssets(): Promise<void> {
  await Promise.all(SAMPLE_IDS.map((id) => ensureSampleAsset(id).catch(() => null)));
}

export async function getSampleAsset(sampleId: SampleId) {
  const key = await ensureSampleAsset(sampleId);
  return getS3().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
}

export function isSampleId(value: string): value is SampleId {
  return (SAMPLE_IDS as readonly string[]).includes(value);
}