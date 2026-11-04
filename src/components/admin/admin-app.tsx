"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DeductionScope,
  PricingCategoryCode,
  PricingConfig,
} from "@/lib/valuation/pricing";

type ViewState = "loading" | "login" | "ready" | "unconfigured" | "error";

type ActivePayload = {
  version: number;
  config: PricingConfig;
  updatedAt: string | null;
  fallback: boolean;
  fallbackReason: string | null;
};

type HistoryItem = {
  version: number;
  active: boolean;
  createdAt: string;
};

type DraftTier = { maxKg: string; yuanPerTon: string };

type DraftCategory = {
  code: PricingCategoryCode;
  label: string;
  mode: "ton" | "unit";
  tiers: DraftTier[];
  unitYuan: string;
};

type DraftDeduction = {
  code: string;
  name: string;
  unit: string;
  yuan: string;
  scope: DeductionScope;
};

type Draft = {
  provider: string;
  rateCardVersion: string;
  categories: DraftCategory[];
  deductions: DraftDeduction[];
  steelRimYuanPerTon: string;
  towFreeKm: string;
  towYuanPerKm: string;
  serviceYuan: string;
  weightUncertaintyPct: string;
  commonMissingYuan: string;
  highBandPct: string;
  marketAdjustmentPct: string;
  market: {
    scrapSteelYuanPerTon: string;
    aluminumYuanPerTon: string;
    copperYuanPerTon: string;
    note: string;
    updatedAt: string;
  };
};

function fenToText(fen: number): string {
  return String(fen / 100);
}

function yuanToFen(text: string): number {
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
}

function toDraft(config: PricingConfig): Draft {
  return {
    provider: config.provider,
    rateCardVersion: config.rateCardVersion,
    categories: config.categories.map((category) => ({
      code: category.code,
      label: category.label,
      mode: category.mode,
      tiers: category.tiers.map((tier) => ({
        maxKg: tier.maxKg === null ? "" : String(tier.maxKg),
        yuanPerTon: fenToText(tier.fenPerTon),
      })),
      unitYuan: category.unitFen === null ? "" : fenToText(category.unitFen),
    })),
    deductions: config.deductions.map((item) => ({
      code: item.code,
      name: item.name,
      unit: item.unit,
      yuan: fenToText(item.fen),
      scope: item.scope,
    })),
    steelRimYuanPerTon: fenToText(config.steelRimDiscountFenPerTon),
    towFreeKm: String(config.towFreeKm),
    towYuanPerKm: fenToText(config.towFenPerKm),
    serviceYuan: fenToText(config.serviceFeeFen),
    weightUncertaintyPct: String(config.weightUncertaintyPct),
    commonMissingYuan: fenToText(config.commonMissingDeductionFen),
    highBandPct: String(config.highBandPct),
    marketAdjustmentPct: String(config.marketAdjustmentPct),
    market: {
      scrapSteelYuanPerTon: fenToText(config.marketReference.scrapSteelFenPerTon),
      aluminumYuanPerTon: fenToText(config.marketReference.aluminumFenPerTon),
      copperYuanPerTon: fenToText(config.marketReference.copperFenPerTon),
      note: config.marketReference.note,
      updatedAt: config.marketReference.updatedAt,
    },
  };
}

function toConfig(draft: Draft): unknown {
  return {
    provider: draft.provider.trim(),
    rateCardVersion: draft.rateCardVersion.trim(),
    categories: draft.categories.map((category) => ({
      code: category.code,
      label: category.label.trim(),
      mode: category.mode,
      tiers:
        category.mode === "ton"
          ? category.tiers
              .map((tier) => ({
                maxKg: tier.maxKg.trim() === "" ? null : Number(tier.maxKg),
                fenPerTon: yuanToFen(tier.yuanPerTon),
              }))
              .sort((a, b) => {
                if (a.maxKg === null) return 1;
                if (b.maxKg === null) return -1;
                return a.maxKg - b.maxKg;
              })
          : [],
      unitFen: category.mode === "unit" ? yuanToFen(category.unitYuan) : null,
    })),
    deductions: draft.deductions.map((item) => ({
      code: item.code.trim(),
      name: item.name.trim(),
      unit: item.unit.trim(),
      fen: yuanToFen(item.yuan),
      scope: item.scope,
    })),
    steelRimDiscountFenPerTon: yuanToFen(draft.steelRimYuanPerTon),
    towFreeKm: Number(draft.towFreeKm),
    towFenPerKm: yuanToFen(draft.towYuanPerKm),
    serviceFeeFen: yuanToFen(draft.serviceYuan),
    weightUncertaintyPct: Number(draft.weightUncertaintyPct),
    commonMissingDeductionFen: yuanToFen(draft.commonMissingYuan),
    highBandPct: Number(draft.highBandPct),
    marketAdjustmentPct: Number(draft.marketAdjustmentPct),
    marketReference: {
      scrapSteelFenPerTon: yuanToFen(draft.market.scrapSteelYuanPerTon),
      aluminumFenPerTon: yuanToFen(draft.market.aluminumYuanPerTon),
      copperFenPerTon: yuanToFen(draft.market.copperYuanPerTon),
      note: draft.market.note,
      updatedAt: draft.market.updatedAt,
    },
  };
}

function formatTime(iso: string | null): string {
  if (!iso) return "未发布";
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-dim">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-dim">{hint}</span> : null}
    </label>
  );
}

export function AdminApp() {
  const [view, setView] = useState<ViewState>("loading");
  const [setup, setSetup] = useState<string[]>([]);
  const [active, setActive] = useState<ActivePayload | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/guanli/pricing", { cache: "no-store" });
      if (response.status === 503) {
        const payload = (await response.json()) as {
          error?: string;
          setup?: string[];
        };
        setSetup(payload.setup ?? [payload.error ?? "管理员密码未配置。"]);
        setView("unconfigured");
        return;
      }
      if (response.status === 401) {
        setView("login");
        return;
      }
      if (!response.ok) {
        setView("error");
        setMessage("定价配置读取失败，请检查服务与数据库。");
        return;
      }
      const payload = (await response.json()) as {
        ok: true;
        active: ActivePayload;
        history: HistoryItem[];
        historyError: string | null;
      };
      setActive(payload.active);
      setHistory(payload.history ?? []);
      setDraft(toDraft(payload.active.config));
      setView("ready");
      if (payload.historyError) setMessage(payload.historyError);
    } catch {
      setView("error");
      setMessage("定价配置读取失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const login = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/guanli/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "登录失败。");
        return;
      }
      setPassword("");
      await load();
    } catch {
      setMessage("登录失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/guanli/logout", { method: "POST" });
    setActive(null);
    setDraft(null);
    setView("login");
    setMessage(null);
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    setErrors([]);
    try {
      const response = await fetch("/api/guanli/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: toConfig(draft) }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        version?: number;
        error?: string;
        errors?: string[];
      };
      if (!response.ok || !payload.ok) {
        setErrors(payload.errors ?? []);
        setMessage(payload.error ?? "保存失败。");
        return;
      }
      setMessage(`已发布 v${payload.version}。`);
      await load();
    } catch {
      setMessage("保存失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const patchCategory = (index: number, patch: Partial<DraftCategory>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            categories: current.categories.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  };

  const patchTier = (categoryIndex: number, tierIndex: number, patch: Partial<DraftTier>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            categories: current.categories.map((item, itemIndex) =>
              itemIndex === categoryIndex
                ? {
                    ...item,
                    tiers: item.tiers.map((tier, index) =>
                      index === tierIndex ? { ...tier, ...patch } : tier,
                    ),
                  }
                : item,
            ),
          }
        : current,
    );
  };

  const patchDeduction = (index: number, patch: Partial<DraftDeduction>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            deductions: current.deductions.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  };

  const patchMarket = (patch: Partial<Draft["market"]>) => {
    setDraft((current) =>
      current ? { ...current, market: { ...current.market, ...patch } } : current,
    );
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="leading-tight">
            <p className="text-base font-black tracking-tight">定价管理</p>
            <p className="mono text-[10px] tracking-[0.14em] text-dim">PRICING ADMIN</p>
          </div>
          {view === "ready" ? (
            <div className="flex items-center gap-2">
              <a href="/guanli/tongji" className="btn-secondary min-h-[40px] px-3 text-sm">
                数据统计
              </a>
              <button
                type="button"
                onClick={() => void logout()}
                className="btn-secondary min-h-[40px] px-3 text-sm"
              >
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        {view === "loading" ? (
          <p className="text-sm text-dim">正在读取定价配置…</p>
        ) : null}

        {view === "unconfigured" ? (
          <div className="panel p-5 sm:p-6">
            <h1 className="text-lg font-black tracking-tight">管理员密码未配置</h1>
            <p className="mt-2 text-sm text-dim">管理接口暂不可用。请按以下步骤设置后重启服务：</p>
            <ol className="mt-3 space-y-2 text-sm">
              {setup.map((item, index) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mono text-brand">{index + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-dim">
              密码只从环境变量读取，不会写入代码或前端。定价配置本身是公开数据。
            </p>
          </div>
        ) : null}

        {view === "login" ? (
          <div className="panel mx-auto mt-10 max-w-md p-5 sm:p-6">
            <h1 className="text-lg font-black tracking-tight">管理员登录</h1>
            <p className="mt-1 text-xs text-dim">使用 ADMIN_PASSWORD 环境变量中的密码。</p>
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void login();
              }}
            >
              <Field label="管理员密码">
                <input
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  className="input mt-1"
                />
              </Field>
              {message ? (
                <p role="alert" className="mt-3 rounded-lg bg-danger/8 px-3 py-2 text-xs text-danger">
                  {message}
                </p>
              ) : null}
              <button type="submit" disabled={busy || !password} className="btn-primary mt-4 w-full">
                {busy ? "登录中…" : "登录"}
              </button>
            </form>
          </div>
        ) : null}

        {view === "error" ? (
          <div className="panel p-5 sm:p-6">
            <h1 className="text-lg font-black tracking-tight">读取失败</h1>
            <p className="mt-2 text-sm text-danger">{message}</p>
            <button type="button" onClick={() => void load()} className="btn-secondary mt-4 text-sm">
              重试
            </button>
          </div>
        ) : null}

        {view === "ready" && draft && active ? (
          <div className="space-y-5">
            <div className="panel-strong p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">当前生效版本</p>
                  <p className="mt-1 text-2xl font-black tracking-tight">
                    {active.version > 0 ? `v${active.version}` : "内置价目表"}
                  </p>
                  <p className="mt-1 text-xs text-dim">
                    {active.config.provider} · 价目表 {active.config.rateCardVersion} · 最后保存{" "}
                    {formatTime(active.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="tag text-brand">
                    {active.config.categories.length} 个车型档位
                  </span>
                  <span className="tag">{active.config.deductions.length} 个缺件项</span>
                </div>
              </div>
              {active.fallback ? (
                <p className="mt-3 rounded-lg bg-warn/8 px-3 py-2 text-xs text-warn">
                  {active.fallbackReason ?? "当前使用内置默认价目表。"}
                </p>
              ) : null}
            </div>

            {message ? (
              <p role="status" className="rounded-lg bg-brand-soft px-3.5 py-2.5 text-xs text-brand">
                {message}
              </p>
            ) : null}
            {errors.length > 0 ? (
              <div role="alert" className="rounded-lg bg-danger/8 px-3.5 py-2.5 text-xs text-danger">
                <p className="font-semibold">校验未通过：</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* 行情参考 */}
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-black tracking-tight">行情参考</h2>
                  <p className="mt-1 text-xs text-dim">
                    参考价只供人工判断，不会自动参与计算；需要调价时改下方「行情联动」系数，统一作用于全部吨价。单位：元/吨。
                  </p>
                </div>
                <span className="tag">参考 + 联动系数</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="废钢（元/吨）">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={draft.market.scrapSteelYuanPerTon}
                    onChange={(event) => patchMarket({ scrapSteelYuanPerTon: event.target.value })}
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="铝（元/吨）">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={draft.market.aluminumYuanPerTon}
                    onChange={(event) => patchMarket({ aluminumYuanPerTon: event.target.value })}
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="铜（元/吨）">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={draft.market.copperYuanPerTon}
                    onChange={(event) => patchMarket({ copperYuanPerTon: event.target.value })}
                    className="input mono mt-1"
                  />
                </Field>
              </div>
              <div className="mt-3 max-w-[240px]">
                <Field
                  label="行情联动（%）"
                  hint="按铜/铁/铝行情判断后，对全部吨价统一上浮或下调；0 = 按价目表"
                >
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    step="0.1"
                    value={draft.marketAdjustmentPct}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, marketAdjustmentPct: event.target.value }
                          : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
                <Field label="备注">
                  <input
                    type="text"
                    value={draft.market.note}
                    onChange={(event) => patchMarket({ note: event.target.value })}
                    className="input mt-1"
                  />
                </Field>
                <Field label="行情日期">
                  <input
                    type="date"
                    value={draft.market.updatedAt}
                    onChange={(event) => patchMarket({ updatedAt: event.target.value })}
                    className="input mono mt-1"
                  />
                </Field>
              </div>
            </section>

            {/* 车型吨价表 */}
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-black tracking-tight">车型吨价表</h2>
                  <p className="mt-1 text-xs text-dim">
                    吨价按元/吨填写；上限留空表示无上限，保存时自动按上限升序排列。按辆计价车型填元/辆。
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {draft.categories.map((category, categoryIndex) => (
                  <div key={category.code} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="tag shrink-0">{category.code}</span>
                        <input
                          type="text"
                          aria-label={`${category.code} 名称`}
                          value={category.label}
                          onChange={(event) =>
                            patchCategory(categoryIndex, { label: event.target.value })
                          }
                          className="input h-10 min-w-0 flex-1 text-sm"
                        />
                      </div>
                      <span className="tag shrink-0">
                        {category.mode === "ton" ? "按吨计价" : "按辆计价"}
                      </span>
                    </div>

                    {category.mode === "ton" ? (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left text-xs">
                          <thead>
                            <tr className="text-dim">
                              <th className="pb-1.5 font-semibold">档位上限（kg）</th>
                              <th className="pb-1.5 font-semibold">吨价（元/吨）</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.tiers.map((tier, tierIndex) => (
                              <tr key={`${category.code}-${tierIndex}`}>
                                <td className="py-1 pr-2">
                                  <input
                                    type="number"
                                    min={1}
                                    step="1"
                                    aria-label={`${category.code} 第 ${tierIndex + 1} 档上限`}
                                    placeholder="无上限"
                                    value={tier.maxKg}
                                    onChange={(event) =>
                                      patchTier(categoryIndex, tierIndex, {
                                        maxKg: event.target.value,
                                      })
                                    }
                                    className="input mono h-10 w-full"
                                  />
                                </td>
                                <td className="py-1">
                                  <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    aria-label={`${category.code} 第 ${tierIndex + 1} 档吨价`}
                                    value={tier.yuanPerTon}
                                    onChange={(event) =>
                                      patchTier(categoryIndex, tierIndex, {
                                        yuanPerTon: event.target.value,
                                      })
                                    }
                                    className="input mono h-10 w-full"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-3 max-w-[220px]">
                        <Field label="按辆价格（元/辆）">
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={category.unitYuan}
                            onChange={(event) =>
                              patchCategory(categoryIndex, { unitYuan: event.target.value })
                            }
                            className="input mono mt-1"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 缺件扣款目录 */}
            <section className="panel p-5 sm:p-6">
              <h2 className="text-lg font-black tracking-tight">缺件扣款目录</h2>
              <p className="mt-1 text-xs text-dim">
                金额按元填写；适用范围 car = 小车，truck = 大车，all = 全部。
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="text-dim">
                      <th className="pb-1.5 font-semibold">编码</th>
                      <th className="pb-1.5 font-semibold">名称</th>
                      <th className="pb-1.5 font-semibold">单位</th>
                      <th className="pb-1.5 font-semibold">扣款（元）</th>
                      <th className="pb-1.5 font-semibold">范围</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.deductions.map((item, index) => (
                      <tr key={item.code}>
                        <td className="py-1 pr-2">
                          <input
                            type="text"
                            aria-label={`缺件 ${index + 1} 编码`}
                            value={item.code}
                            onChange={(event) =>
                              patchDeduction(index, { code: event.target.value })
                            }
                            className="input mono h-10 w-full text-xs"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="text"
                            aria-label={`缺件 ${index + 1} 名称`}
                            value={item.name}
                            onChange={(event) =>
                              patchDeduction(index, { name: event.target.value })
                            }
                            className="input h-10 w-full text-xs"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="text"
                            aria-label={`缺件 ${index + 1} 单位`}
                            value={item.unit}
                            onChange={(event) =>
                              patchDeduction(index, { unit: event.target.value })
                            }
                            className="input h-10 w-20 text-xs"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            step="1"
                            aria-label={`缺件 ${index + 1} 金额`}
                            value={item.yuan}
                            onChange={(event) =>
                              patchDeduction(index, { yuan: event.target.value })
                            }
                            className="input mono h-10 w-24 text-xs"
                          />
                        </td>
                        <td className="py-1">
                          <select
                            aria-label={`缺件 ${index + 1} 适用范围`}
                            value={item.scope}
                            onChange={(event) =>
                              patchDeduction(index, {
                                scope: event.target.value as DeductionScope,
                              })
                            }
                            className="input h-10 w-24 text-xs"
                          >
                            <option value="all">all</option>
                            <option value="car">car</option>
                            <option value="truck">truck</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 拖运 / 服务费 */}
            <section className="panel p-5 sm:p-6">
              <h2 className="text-lg font-black tracking-tight">拖运 / 服务费</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="免费拖运里程（公里）">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={draft.towFreeKm}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, towFreeKm: event.target.value } : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="超出部分（元/公里）">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.towYuanPerKm}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, towYuanPerKm: event.target.value } : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="服务费（元）">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.serviceYuan}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, serviceYuan: event.target.value } : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
              </div>
            </section>

            {/* 区间参数 */}
            <section className="panel p-5 sm:p-6">
              <h2 className="text-lg font-black tracking-tight">区间参数</h2>
              <p className="mt-1 text-xs text-dim">
                区间按 A 区小计计算，金额均按元填写。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="重量不确定性（%）">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step="0.1"
                    value={draft.weightUncertaintyPct}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, weightUncertaintyPct: event.target.value }
                          : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="缺件预留扣款（元）">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.commonMissingYuan}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, commonMissingYuan: event.target.value } : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="高价上浮（%）">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step="0.1"
                    value={draft.highBandPct}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, highBandPct: event.target.value } : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
                <Field label="铁轮毂每吨扣减（元/吨）">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={draft.steelRimYuanPerTon}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, steelRimYuanPerTon: event.target.value } : current,
                      )
                    }
                    className="input mono mt-1"
                  />
                </Field>
              </div>
            </section>

            <div className="panel-strong flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div>
                <p className="text-sm font-bold">保存并发布</p>
                <p className="mt-0.5 text-xs text-dim">
                  保存后立即成为公开页的生效版本，旧版本保留在历史中。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="btn-primary min-w-[160px] text-sm"
              >
                {busy ? "保存中…" : "保存并发布"}
              </button>
            </div>

            <section className="panel p-5 sm:p-6">
              <h2 className="text-lg font-black tracking-tight">版本历史</h2>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-dim">还没有发布过版本，当前使用内置价目表。</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {history.map((item) => (
                    <li key={item.version} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="mono font-bold">v{item.version}</span>
                      <span className="text-xs text-dim">{formatTime(item.createdAt)}</span>
                      <span className={`tag ${item.active ? "text-brand" : "text-dim"}`}>
                        {item.active ? "生效中" : "历史版本"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}