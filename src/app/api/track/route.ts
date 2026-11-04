import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { recordVisit } from "@/lib/analytics/log";

const VISITOR_COOKIE = "baofei_vid";
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60;

function sanitizeReferrer(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

function isSecure(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** 首页访问埋点：匿名 visitor_id，不记录 IP。 */
export async function POST(request: NextRequest) {
  let body: { path?: unknown; referrer?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // 仍然记录一次默认首页访问
  }

  const rawPath = typeof body.path === "string" ? body.path : "/";
  const path = rawPath.startsWith("/") ? rawPath.slice(0, 200) : "/";
  const referrer =
    typeof body.referrer === "string"
      ? body.referrer
      : request.headers.get("referer") ?? null;

  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId =
    existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();

  await recordVisit({
    visitorId,
    path,
    referrer: sanitizeReferrer(referrer),
    userAgent: request.headers.get("user-agent"),
  });

  const response = new NextResponse(null, { status: 204 });
  if (!existing) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure(request),
      path: "/",
      maxAge: VISITOR_MAX_AGE,
    });
  }
  return response;
}