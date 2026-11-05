"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatYuan } from "@/lib/domain/money";

type CountSet = { today: number; last7: number; last30: number; total: number };

type StatsPayload = {
  ok: true;
  generatedAt: string;
  visits: {
    views: CountSet;
    visitors: CountSet;
  };
  vin: {
    total: CountSet;
    ok: { today: number; last7: number; last30: number };
    uniqueVin30d: number;
  };
  providerUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
  daily: Array<{
    date: string;
    label: string;
    views: number;
    visitors: number;
    vinQueries: number;
    vinOk: number;
  }>;
  recent: Array<{
    id: string;
    vin: string;
    isDemo: boolean;
    status: "ok" | "not_found" | "error";
    errorCode: string | null;
    brandModel: string | null;
    vehicleType: string | null;
    provider: string | null;
    pricingVersion: number | null;
    quote: {
      lowFen: number | null;
      midFen: number | null;
      highFen: number | null;
      netFen: number | null;
    };
    queriedAt: string;
  }>;
};

const numberFormat = new Intl.NumberFormat("zh-CN");

function fmt(value: number): string {
  return numberFormat.format(value);
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function providerLabel(provider: string | null): string {
  if (!provider) return "—";
  if (provider === "demo") return "示例";
  if (provider === "jisuepc") return "极速车服";
  return provider;
}

function statusMeta(status: "ok" | "not_found" | "error"): {
  label: string;
  className: string;
} {
  if (status === "ok") return { label: "成功", className: "text-brand" };
  if (status === "not_found") return { label: "未查到", className: "text-warn" };
  return { label: "渠道异常", className: "text-danger" };
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="label">{label}</p>
      <p className="mono mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-dim">{hint}</p>
    </div>
  );
}

function MiniBars({
  title,
  subtitle,
  rows,
  primaryKey,
  secondaryKey,
}: {
  title: string;
  subtitle: string;
  rows: StatsPayload["daily"];
  primaryKey: "views" | "vinQueries";
  secondaryKey: "visitors" | "vinOk";
}) {
  const max = Math.max(
    1,
    ...rows.map((row) => Math.max(row[primaryKey], row[secondaryKey])),
  );

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-black tracking-tight">{title}</h2>
          <p className="mt-1 text-[11px] text-dim">{subtitle}</p>
        </div>
        <span className="tag">近 14 天</span>
      </div>
      <div className="mt-4 flex h-36 items-end gap-1.5">
        {rows.map((row) => {
          const primary = row[primaryKey];
          const secondary = row[secondaryKey];
          return (
            <div
              key={row.date}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
              title={`${row.date} 主 ${primary} / 次 ${secondary}`}
            >
              <div className="flex flex-1 items-end gap-[2px]">
                <div
                  className="w-full rounded-t-sm bg-brand/25"
                  style={{
                    height: primary === 0 ? "0%" : `${Math.max(3, (primary / max) * 100)}%`,
                  }}
                />
                <div
                  className="w-full rounded-t-sm bg-brand"
                  style={{
                    height: secondary === 0 ? "0%" : `${Math.max(3, (secondary / max) * 100)}%`,
                  }}
                />
              </div>
              <span className="mono truncate text-center text-[8px] text-dim">
                {row.label.slice(3)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-brand/25" aria-hidden />
          {primaryKey === "views" ? "浏览次数" : "VIN 查询"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-brand" aria-hidden />
          {secondaryKey === "visitors" ? "访客数" : "查询成功"}
        </span>
      </div>
    </section>
  );
}

export function StatsApp() {
  const router = useRouter();
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/guanli/stats", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.push("/guanli");
        return;
      }
      const payload = (await response.json()) as StatsPayload | { ok: false; error?: string };
      if (!response.ok || !("ok" in payload) || !payload.ok) {
        setError("error" in payload && payload.error ? payload.error : "统计数据读取失败。");
        return;
      }
      setData(payload);
    } catch {
      setError("统计数据读取失败，请检查网络后重试。");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load, router]);

  const logout = async () => {
    await fetch("/api/guanli/logout", { method: "POST", credentials: "same-origin" });
    router.push("/guanli");
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="leading-tight">
            <p className="text-base font-black tracking-tight">数据统计</p>
            <p className="mono text-[10px] tracking-[0.14em] text-dim">ANALYTICS</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/guanli" className="btn-secondary min-h-[40px] px-3 text-xs sm:text-sm">
              定价管理
            </a>
            <button
              type="button"
              onClick={() => void logout()}
              className="btn-secondary min-h-[40px] px-3 text-xs sm:text-sm"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">访问与 VIN 查询</h1>
            <p className="mt-1 text-xs text-dim">
              访客按匿名 cookie 去重，不记录 IP；VIN 记录保留查询时间、车型与渠道结果。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-dim">
              更新于 {formatTime(data?.generatedAt ?? null)}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary min-h-[40px] px-4 text-sm"
              disabled={loading}
            >
              {loading ? "刷新中…" : "刷新"}
            </button>
          </div>
        </div>

        {error ? (
          <div role="alert" className="mt-5 rounded-xl bg-danger/8 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {!data && loading ? (
          <p className="mt-8 text-sm text-dim">正在读取统计数据…</p>
        ) : null}

        {data ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="今日访客"
                value={fmt(data.visits.visitors.today)}
                hint={`今日浏览 ${fmt(data.visits.views.today)} 次`}
              />
              <Kpi
                label="近 7 日访客"
                value={fmt(data.visits.visitors.last7)}
                hint={`近 7 日浏览 ${fmt(data.visits.views.last7)} 次`}
              />
              <Kpi
                label="今日 VIN 查询"
                value={fmt(data.vin.total.today)}
                hint={`成功 ${fmt(data.vin.ok.today)} 次`}
              />
              <Kpi
                label="累计访客"
                value={fmt(data.visits.visitors.total)}
                hint={`累计浏览 ${fmt(data.visits.views.total)} 次`}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="panel p-4">
                <p className="label">近 30 日访客</p>
                <p className="mono mt-1.5 text-xl font-black">{fmt(data.visits.visitors.last30)}</p>
              </div>
              <div className="panel p-4">
                <p className="label">近 30 日 VIN 查询</p>
                <p className="mono mt-1.5 text-xl font-black">{fmt(data.vin.total.last30)}</p>
                <p className="mt-0.5 text-[11px] text-dim">
                  去重 VIN {fmt(data.vin.uniqueVin30d)} 个
                </p>
              </div>
              <div className="panel p-4">
                <p className="label">今日渠道调用</p>
                <p className="mono mt-1.5 text-xl font-black">
                  {fmt(data.providerUsage.used)} / {fmt(data.providerUsage.limit)}
                </p>
                <p className="mt-0.5 text-[11px] text-dim">
                  剩余 {fmt(data.providerUsage.remaining)} 次；超限后仅缓存结果可用
                </p>
              </div>
              <div className="panel p-4">
                <p className="label">近 7 日查询成功率</p>
                <p className="mono mt-1.5 text-xl font-black">
                  {data.vin.total.last7 > 0
                    ? `${Math.round((data.vin.ok.last7 / data.vin.total.last7) * 100)}%`
                    : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-dim">
                  成功 {fmt(data.vin.ok.last7)} / 共 {fmt(data.vin.total.last7)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <MiniBars
                title="访问趋势"
                subtitle="浅色为浏览次数，深色为去重访客"
                rows={data.daily}
                primaryKey="views"
                secondaryKey="visitors"
              />
              <MiniBars
                title="VIN 查询趋势"
                subtitle="浅色为查询次数，深色为成功次数"
                rows={data.daily}
                primaryKey="vinQueries"
                secondaryKey="vinOk"
              />
            </div>

            <section className="panel mt-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black tracking-tight">最近 VIN 查询</h2>
                  <p className="mt-1 text-[11px] text-dim">
                    最多显示最近 100 条，时间均为北京时间。
                  </p>
                </div>
                <span className="tag">共 {fmt(data.vin.total.total)} 条</span>
              </div>

              {data.recent.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-dim">
                  还没有 VIN 查询记录。用户提交评估后会自动出现在这里。
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-dim">
                        <th className="py-2 pr-3 font-semibold">时间</th>
                        <th className="py-2 pr-3 font-semibold">VIN</th>
                        <th className="py-2 pr-3 font-semibold">查询价格</th>
                        <th className="py-2 font-semibold">车型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((row) => (
                        <tr key={row.id} className="border-b border-line/60 last:border-0">
                          <td className="mono py-2.5 pr-3 whitespace-nowrap text-dim">
                            {row.queriedAt}
                          </td>
                          <td className="mono py-2.5 pr-3 whitespace-nowrap font-semibold">
                            {row.vin}
                            {row.isDemo ? (
                              <span className="ml-1.5 text-[10px] font-normal text-warn">示例</span>
                            ) : null}
                            <p className="mt-0.5 text-[10px] font-normal text-dim">
                              {providerLabel(row.provider)} ·{" "}
                              <span className={statusMeta(row.status).className}>
                                {statusMeta(row.status).label}
                              </span>
                              {row.errorCode ? (
                                <span className="mono ml-1">{row.errorCode}</span>
                              ) : null}
                            </p>
                          </td>
                          <td className="mono py-2.5 pr-3 whitespace-nowrap">
                            {row.quote.lowFen !== null && row.quote.highFen !== null ? (
                              <>
                                <p className="text-sm font-black text-brand">
                                  ¥{formatYuan(row.quote.lowFen)}–¥{formatYuan(row.quote.highFen)}
                                </p>
                                {row.quote.midFen !== null ? (
                                  <p className="text-[10px] text-dim">
                                    中值 ¥{formatYuan(row.quote.midFen)}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-dim">价格待确认</span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <p className="font-semibold">{row.brandModel ?? "—"}</p>
                            <p className="text-[10px] text-dim">{row.vehicleType ?? "—"}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}