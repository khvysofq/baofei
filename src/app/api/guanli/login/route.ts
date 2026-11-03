import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SETUP_HINT,
  adminConfigured,
  adminCookieOptions,
  clearLoginFailures,
  clientKeyFromRequest,
  createSessionToken,
  loginThrottleStatus,
  registerLoginFailure,
  verifyAdminPassword,
} from "@/lib/admin/auth";

function unavailable() {
  return NextResponse.json(
    { ok: false, ...ADMIN_SETUP_HINT },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  if (!adminConfigured()) return unavailable();

  const key = clientKeyFromRequest(request);
  const throttle = loginThrottleStatus(key);
  if (!throttle.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `尝试次数过多，请 ${throttle.retryAfterSec} 秒后再试。`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(throttle.retryAfterSec) },
      },
    );
  }

  let payload: { password?: unknown };
  try {
    payload = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不正确。" }, { status: 400 });
  }

  if (typeof payload.password !== "string" || !payload.password) {
    return NextResponse.json({ ok: false, error: "请输入管理员密码。" }, { status: 400 });
  }

  if (!verifyAdminPassword(payload.password)) {
    registerLoginFailure(key);
    return NextResponse.json({ ok: false, error: "密码不正确。" }, { status: 401 });
  }

  clearLoginFailures(key);
  const token = createSessionToken();
  if (!token) return unavailable();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions(request));
  return response;
}