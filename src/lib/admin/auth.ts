/**
 * 管理员会话（仅服务端使用）
 *
 * - 密码只从环境变量读取，绝不写死在代码里。
 * - 会话 = HttpOnly cookie，HMAC-SHA256 签名，默认 8 小时有效。
 * - 登录失败限流放在进程内存；多实例部署时各实例独立计数。
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "baofei_guanli";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

export const ADMIN_SETUP_HINT = {
  error: "管理员密码未配置，管理接口暂不可用。",
  setup: [
    "在 .env.local 或部署环境变量中设置 ADMIN_PASSWORD",
    "可选：设置 ADMIN_SESSION_SECRET 作为独立签名密钥；未设置时使用 ADMIN_PASSWORD",
    "重启服务后访问 /guanli 登录",
  ],
};

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_MS = 10 * 60 * 1000;

type LoginAttempt = {
  failures: number;
  firstAt: number;
  blockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function adminSecret(): string | null {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim();
  return secret ? secret : null;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** 定长哈希后比较，避免密码长度泄露与普通字符串比较的时序差。 */
export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  const a = sha256(input);
  const b = sha256(expected);
  return timingSafeEqual(a, b);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

export function createSessionToken(nowMs = Date.now()): string | null {
  const secret = adminSecret();
  if (!secret) return null;
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + ADMIN_SESSION_SECONDS;
  const nonce = randomBytes(12).toString("base64url");
  const payload = `${issuedAt}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  nowMs = Date.now(),
): boolean {
  const secret = adminSecret();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [issuedAtText, expiresAtText, nonce, signature] = parts;
  const issuedAt = Number(issuedAtText);
  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(issuedAt) || !Number.isInteger(expiresAt)) return false;
  if (!nonce) return false;

  const nowSeconds = Math.floor(nowMs / 1000);
  if (expiresAt <= nowSeconds || issuedAt > nowSeconds + 60) return false;

  const payload = `${issuedAtText}.${expiresAtText}.${nonce}`;
  const expected = Buffer.from(sign(payload, secret), "base64url");
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * 本地 HTTP 开发时不能给 cookie 加 Secure（否则浏览器不保存），
 * 生产 HTTPS 仍必须带 Secure。优先按请求的真实协议判断。
 */
function isSecureRequest(input?: Request | { secure: boolean }): boolean {
  if (!input) return process.env.NODE_ENV === "production";
  if ("secure" in input) return input.secure;
  const forwarded = input.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }
  try {
    return new URL(input.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function adminCookieOptions(input?: Request | { secure: boolean }) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(input),
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  };
}

export function loginThrottleStatus(key: string, nowMs = Date.now()): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const attempt = loginAttempts.get(key);
  if (!attempt) return { allowed: true, retryAfterSec: 0 };

  if (attempt.blockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((attempt.blockedUntil - nowMs) / 1000)),
    };
  }

  if (nowMs - attempt.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true, retryAfterSec: 0 };
  }

  return { allowed: true, retryAfterSec: 0 };
}

export function registerLoginFailure(key: string, nowMs = Date.now()): void {
  const attempt = loginAttempts.get(key);
  if (!attempt || nowMs - attempt.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { failures: 1, firstAt: nowMs, blockedUntil: 0 });
    return;
  }
  attempt.failures += 1;
  if (attempt.failures >= LOGIN_MAX_FAILURES) {
    attempt.blockedUntil = nowMs + LOGIN_BLOCK_MS;
  }
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}

/** 取客户端标识用于限流；反向代理场景取 X-Forwarded-For 第一段。 */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}