import { fail } from "@/lib/api";
import { query } from "@/lib/db";
import { getSampleAsset, isSampleId, SAMPLE_IDS } from "@/lib/storage";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let sampleId = id;

  if (!isSampleId(sampleId)) {
    // 也允许用 documents.id 访问，自动解析到样例。
    try {
      const rows = await query(
        "SELECT sample_id FROM documents WHERE id = $1",
        [id],
      );
      const resolved = rows[0]?.sample_id ? String(rows[0].sample_id) : null;
      if (!resolved) {
        return fail(new Error("未找到可用的证件样例"), 404);
      }
      sampleId = resolved;
    } catch {
      return fail(new Error("未找到可用的证件样例"), 404);
    }
  }

  if (!isSampleId(sampleId) || !(SAMPLE_IDS as readonly string[]).includes(sampleId)) {
    return fail(new Error("未找到可用的证件样例"), 404);
  }

  try {
    const object = await getSampleAsset(sampleId);
    if (!object.Body) return fail(new Error("证件样例暂不可用"), 502);
    const stream = object.Body.transformToWebStream();
    return new Response(stream, { headers: CACHE_HEADERS });
  } catch {
    return fail(new Error("证件样例暂不可用，请稍后重试。"), 502);
  }
}