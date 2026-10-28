export type ApiEnvelope<T> = { data: T; demo?: boolean };

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const response = await fetch(path, {
    ...init,
    headers,
    body,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `请求失败（${response.status}）`);
  }
  return payload?.data as T;
}

const CASE_KEY = "baofei:caseId";

export function readCaseId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CASE_KEY);
  } catch {
    return null;
  }
}

export function storeCaseId(caseId: string): void {
  try {
    window.localStorage.setItem(CASE_KEY, caseId);
    document.cookie = `baofei_case=${caseId}; path=/; max-age=604800; samesite=lax`;
  } catch {
    // 隐私模式可能禁用存储；当前会话仍可继续
  }
}

export function clearCaseId(): void {
  try {
    window.localStorage.removeItem(CASE_KEY);
    document.cookie = "baofei_case=; path=/; max-age=0; samesite=lax";
  } catch {
    // ignore
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}