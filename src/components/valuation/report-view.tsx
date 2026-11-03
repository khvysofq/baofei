"use client";

import { useMemo, useState } from "react";
import { formatYuan } from "@/lib/domain/money";
import {
  DEFAULT_QUOTE_OPTIONS,
  computeQuote,
  deductionScopeFor,
  type DeductionCatalogItem,
  type QuoteOptions,
  type VinQuoteReport,
  type WeightSource,
} from "@/lib/valuation/pricing";

const WEIGHT_SOURCE_LABEL: Record<WeightSource, string> = {
  vin: "VIN 档案",
  estimated: "推定值",
  missing: "待称重",
};

function yuan(fen: number | null): string {
  return fen === null ? "待确认" : `¥${formatYuan(fen)}`;
}

function formatDateTime(iso: string): string {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-2.5">
      <p className="label text-[10px]">{label}</p>
      <p className="mono mt-0.5 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function LineRow({
  label,
  detail,
  amountFen,
  tone = "plain",
  pending = false,
}: {
  label: string;
  detail: string;
  amountFen: number | null;
  tone?: "plain" | "deduct" | "pending";
  pending?: boolean;
}) {
  const amountClass =
    tone === "deduct"
      ? "text-rust"
      : tone === "pending"
        ? "text-warn"
        : "text-text";
  const prefix = pending ? "预留 " : tone === "deduct" ? "−" : "";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {label}
          {pending ? (
            <span className="tag ml-2 align-middle text-warn">待确认</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-dim">{detail}</p>
      </div>
      <p className={`mono shrink-0 text-sm font-bold ${amountClass}`}>
        {amountFen === null ? "待确认" : `${prefix}¥${formatYuan(amountFen)}`}
      </p>
    </div>
  );
}

function DeductionChip({
  item,
  qty,
  disabled,
  onChange,
}: {
  item: DeductionCatalogItem;
  qty: number;
  disabled: boolean;
  onChange: (qty: number) => void;
}) {
  return (
    <li
      className={`rounded-xl border p-3 transition-colors ${
        qty > 0 ? "border-brand bg-brand-soft" : "border-line bg-panel"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words">{item.name}</p>
          <p className="mono mt-0.5 text-[11px] text-dim">
            缺失少算 ¥{formatYuan(item.fen)} / {item.unit}
          </p>
          <p
            className={`mono mt-0.5 text-[11px] ${
              qty > 0 ? "text-rust" : "text-dim"
            }`}
          >
            {qty > 0
              ? `已选 ${qty}${item.unit} · 少算 ¥${formatYuan(item.fen * qty)}`
              : "当前在车"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={`减少${item.name}数量`}
            disabled={disabled || qty <= 0}
            onClick={() => onChange(Math.max(0, qty - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong text-lg leading-none hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="mono w-6 text-center text-sm font-bold tabular">{qty}</span>
          <button
            type="button"
            aria-label={`增加${item.name}数量`}
            disabled={disabled}
            onClick={() => onChange(qty + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong text-lg leading-none hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </li>
  );
}

export function ReportView({
  report,
  onReset,
}: {
  report: VinQuoteReport;
  onReset: () => void;
}) {
  const [options, setOptions] = useState<QuoteOptions>(() => ({
    ...DEFAULT_QUOTE_OPTIONS,
    missingParts: {},
  }));

  const quote = useMemo(
    () =>
      computeQuote({
        vehicle: report.vehicle,
        pricing: report.pricing,
        options,
      }),
    [report.vehicle, report.pricing, options],
  );

  const { vehicle, pricing } = report;
  const scope = quote.category ? deductionScopeFor(quote.category) : "all";
  const catalog = pricing.deductions.filter(
    (item) => item.scope === "all" || item.scope === scope,
  );
  const steelPreviewFen =
    vehicle.weightKg !== null
      ? Math.round((pricing.steelRimDiscountFenPerTon * vehicle.weightKg) / 1000)
      : null;
  const steelAvailable = quote.category === "sedan_suv";

  const missingLines = quote.deductionLines.filter(
    (line) => line.kind === "missing" && line.amountFen > 0,
  );
  const missingFen = missingLines.reduce((sum, line) => sum + line.amountFen, 0);
  const serviceLines = quote.deductionLines.filter(
    (line) => line.kind === "tow" || line.kind === "service",
  );
  const serviceFen = serviceLines.reduce((sum, line) => sum + line.amountFen, 0);
  const vehicleZoneFen =
    quote.vehicleSubtotalFen === null
      ? null
      : Math.max(0, quote.vehicleSubtotalFen - missingFen);

  const update = (patch: Partial<QuoteOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
  };

  const setPartQty = (code: string, qty: number) => {
    setOptions((current) => {
      const next = { ...current.missingParts };
      if (qty <= 0) delete next[code];
      else next[code] = qty;
      return { ...current, missingParts: next };
    });
  };

  const dataSourceLabel =
    report.dataSource.kind === "provider"
      ? `${report.dataSource.providerLabel ?? "VIN 渠道"} · 实车档案${
          report.dataSource.cached ? "（缓存）" : "（实时）"
        }`
      : "内置演示车型";

  return (
    <section id="report" className="scroll-mt-20 pb-28 print:pb-0 sm:pb-32">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-strong pb-4">
        <div>
          <p className="label text-rust">VIN QUOTE · 参考收购价</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            {vehicle.brandModel}
            <span className="mono ml-2 text-lg font-semibold text-dim">
              {vehicle.vin.slice(0, 3)}…{vehicle.vin.slice(-4)}
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <span className="tag text-brand border-brand/40">{dataSourceLabel}</span>
          <span className="tag text-warn">仅 VIN 估算</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-sm"
          >
            打印 / 存为 PDF
          </button>
          <button type="button" onClick={onReset} className="btn-secondary text-sm">
            重新估价
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="车型" value={`${vehicle.vehicleType} / ${quote.categoryLabel}`} />
        <Stat label="估价时间" value={formatDateTime(report.pricedAt)} />
        <Stat
          label="定价版本"
          value={`${
            report.pricingVersion > 0 ? `v${report.pricingVersion}` : "内置价目表"
          } · ${pricing.rateCardVersion}`}
        />
      </div>

      {/* ① 结论卡 */}
      <div className="panel-strong relative mt-6 overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label">预计到手区间 · 仅 VIN 估算 · 未验车</p>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-text">
              {quote.range ? (
                <>
                  <span className="mono text-3xl font-black sm:text-4xl">
                    ¥{formatYuan(quote.range.lowFen)}
                  </span>
                  <span className="text-dim">–</span>
                  <span className="mono text-3xl font-black sm:text-4xl">
                    ¥{formatYuan(quote.range.highFen)}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-black text-warn">待现场称重后报价</span>
              )}
            </p>
            <p className="mt-2 text-sm text-dim">
              中值{" "}
              <span className="mono font-bold text-brand">
                {quote.netFen === null ? "待确认" : `¥${formatYuan(quote.netFen)}`}
              </span>
              {quote.fenPerTon !== null && quote.weightKg !== null ? (
                <>
                  {" "}
                  · ¥{formatYuan(quote.fenPerTon)}/吨 × {(quote.weightKg / 1000).toFixed(3)} 吨
                </>
              ) : null}
            </p>
          </div>
          <a href="#pricing-controls" className="btn-secondary text-sm no-print">
            调整车值与服务费
          </a>
        </div>

        {quote.unresolved.length > 0 ? (
          <p className="mt-4 rounded-lg bg-warn/8 px-3.5 py-2.5 text-xs leading-relaxed text-warn">
            待确认：{quote.unresolved.join("；")}
          </p>
        ) : null}
      </div>

      {/* ② 计价依据 */}
      <div className="panel mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-black tracking-tight">计价依据</h3>
            <p className="mt-1 text-xs text-dim">
              按回收企业吨价表计算；吨位、档位与价目表版本都会影响结果。
            </p>
          </div>
          <span className="tag shrink-0">
            {pricing.provider} · {pricing.rateCardVersion}
          </span>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            ["车型档位", quote.categoryLabel],
            [
              "计价方式",
              quote.pricingMode === "unit"
                ? "按辆计价"
                : quote.fenPerTon === null
                  ? "待称重后确定档位"
                  : `¥${formatYuan(quote.fenPerTon)} / 吨`,
            ],
            [
              "整备质量",
              quote.weightKg === null
                ? "未知"
                : `${quote.weightKg} kg（${WEIGHT_SOURCE_LABEL[quote.weightSource]}）`,
            ],
            [
              "定价版本",
              `${
                report.pricingVersion > 0 ? `v${report.pricingVersion}` : "内置价目表"
              } · 价目表 ${pricing.rateCardVersion}`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <dt className="shrink-0 text-sm text-dim">{label}</dt>
              <dd className="text-right text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

<div
        id="pricing-controls"
        className="mt-5 grid scroll-mt-24 items-start gap-5 lg:grid-cols-[1.08fr_0.92fr]"
      >
        {/* ③ 车值（可调整） */}
        <div className="panel p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-black tracking-tight">车值</h3>
            <span className="tag shrink-0 text-brand">可调整 · 元</span>
          </div>
          <p className="mt-1 text-xs text-dim">
            吨价车值与缺件少算都计入车值小计，不含拖运和服务费。
          </p>

          <div className="mt-3">
            {quote.baseValueFen !== null ? (
              <LineRow
                label={quote.pricingMode === "unit" ? "整车基价（按辆）" : "整车基价（按吨）"}
                detail={
                  quote.pricingMode === "unit"
                    ? `${quote.categoryLabel} · 按辆计价`
                    : `¥${formatYuan(quote.fenPerTon ?? 0)}/吨 × ${(
                        (quote.weightKg ?? 0) / 1000
                      ).toFixed(3)} 吨`
                }
                amountFen={quote.baseValueFen}
              />
            ) : (
              <LineRow
                label="整车基价"
                detail="整备质量缺失，需地磅称重后才能计算"
                amountFen={null}
                tone="pending"
              />
            )}

            {quote.steelRimApplied ? (
              <LineRow
                label="铁轮毂（相对铝圈）"
                detail={`每吨减 ¥${formatYuan(pricing.steelRimDiscountFenPerTon)} × ${(
                  (quote.weightKg ?? 0) / 1000
                ).toFixed(3)} 吨`}
                amountFen={quote.steelRimAdjustmentFen}
                tone="deduct"
              />
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-dim">
            {quote.pricingMode === "unit"
              ? "按辆计价：整车基价 = 该车型按辆收购价。"
              : "整车基价 = 吨价 × 整备质量 ÷ 1000。未验车，车况与拆散情况以现场为准。"}
          </p>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-bold">轮毂材质</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="轮毂材质">
              <button
                type="button"
                role="radio"
                aria-checked={options.wheelType === "alloy"}
                onClick={() => update({ wheelType: "alloy" })}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  options.wheelType === "alloy"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  铝合金轮毂
                  <span className="tag text-warn">默认假设</span>
                </span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                  未验车，默认按铝圈估算；如为铁轮毂请切换。
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={options.wheelType === "steel"}
                disabled={!steelAvailable}
                onClick={() => update({ wheelType: "steel" })}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  options.wheelType === "steel"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-line-strong"
                } ${steelAvailable ? "" : "cursor-not-allowed opacity-60"}`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">铁轮毂</span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                  {steelAvailable
                    ? `铁轮毂（相对铝圈）每吨减 ¥${formatYuan(
                        pricing.steelRimDiscountFenPerTon,
                      )}${
                        steelPreviewFen !== null
                          ? `，本车约减 ¥${formatYuan(steelPreviewFen)}`
                          : ""
                      }。`
                    : "铁轮毂差价仅适用于小型车档位。"}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">部件状态</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-dim">
                  默认 0 个缺失，即全部在车。按实际缺件调整，车值小计即时重算。
                </p>
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={options.partsConfirmed}
                  onChange={(event) =>
                    update({
                      partsConfirmed: event.target.checked,
                      missingParts: event.target.checked ? {} : options.missingParts,
                    })
                  }
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                主要部件齐全（确认无缺件）
              </label>
            </div>

            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {catalog.map((item) => (
                <DeductionChip
                  key={item.code}
                  item={item}
                  qty={options.missingParts[item.code] ?? 0}
                  disabled={options.partsConfirmed}
                  onChange={(qty) => setPartQty(item.code, qty)}
                />
              ))}
            </ul>
            {options.partsConfirmed ? (
              <p className="mt-2 text-[11px] text-dim">
                已确认主要部件齐全，缺件选择已清空，低价端不再预留缺件扣款。
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-line-strong pt-3">
            <p className="text-sm font-bold">车值小计</p>
            <p className="mono text-lg font-black">{yuan(vehicleZoneFen)}</p>
          </div>
          {!options.partsConfirmed ? (
            <p className="mt-2 text-[11px] leading-relaxed text-warn">
              缺件未核对，低价端另预留 ¥{formatYuan(quote.reservedMissingFen)}
              （已计入区间低价端，不从车值小计再扣一次）。
            </p>
          ) : null}
        </div>

        {/* ④ 服务费 */}
        <div className="panel p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-black tracking-tight">服务费</h3>
            <span className="tag shrink-0">与车值分开</span>
          </div>
          <p className="mt-1 text-xs text-dim">
            拖运与服务费单独计算，从车值小计中扣除，不改变车值。
          </p>

          <div className="mt-4">
            <p className="text-sm font-bold">拖运方式</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="拖运方式">
              <button
                type="button"
                role="radio"
                aria-checked={options.towMode === "pickup"}
                onClick={() => update({ towMode: "pickup" })}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  options.towMode === "pickup"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="text-sm font-bold">上门拖车</span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                  {pricing.towFreeKm} 公里内免费，超出 ¥{formatYuan(pricing.towFenPerKm)}/公里。
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={options.towMode === "self"}
                onClick={() => update({ towMode: "self" })}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  options.towMode === "self"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="text-sm font-bold">自行送车</span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                  自己送到回收网点，不产生拖运费。
                </span>
              </button>
            </div>
            <label htmlFor="tow-distance" className="mt-3 block text-xs text-dim">
              预计拖运里程（公里，可选）
            </label>
            <input
              id="tow-distance"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={options.distanceKm === 0 ? "" : options.distanceKm}
              placeholder={`≤ ${pricing.towFreeKm}`}
              disabled={options.towMode === "self"}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                update({
                  distanceKm: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                });
              }}
              className="input mono mt-1 h-11 max-w-[180px] disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-dim">
              不填按免费里程内计算；超出部分才另计拖运费。
            </p>
          </div>

          <div className="mt-4 border-t border-line pt-2">
            {serviceLines.map((line) => (
              <LineRow
                key={`${line.kind}-${line.code ?? line.label}`}
                label={line.label}
                detail={line.detail}
                amountFen={line.amountFen}
                tone={line.amountFen > 0 ? "deduct" : "plain"}
              />
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-line-strong pt-3">
            <p className="text-sm font-bold">服务费小计</p>
            <p className="mono text-lg font-black text-rust">
              −¥{formatYuan(serviceFen)}
            </p>
          </div>
        </div>
      </div>

      {/* ⑤ 合计 */}
      <div className="panel-strong mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="label text-rust">预计到手</p>
            <p className="mt-1 text-sm text-dim">车值小计 − 服务费小计，与上方区间中值一致。</p>
          </div>
          <p className="mono text-2xl font-black text-brand">
            {quote.netFen === null ? "待称重" : `¥${formatYuan(quote.netFen)}`}
          </p>
        </div>
        <div className="mono mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-raise/70 px-3 py-2">
            <p className="text-[10px] tracking-[0.1em] text-dim">车值小计</p>
            <p className="mt-0.5 font-bold">{yuan(vehicleZoneFen)}</p>
          </div>
          <div className="rounded-lg bg-raise/70 px-3 py-2">
            <p className="text-[10px] tracking-[0.1em] text-dim">服务费小计</p>
            <p className="mt-0.5 font-bold text-rust">−¥{formatYuan(serviceFen)}</p>
          </div>
          <div className="rounded-lg bg-raise/70 px-3 py-2">
            <p className="text-[10px] tracking-[0.1em] text-dim">预计到手</p>
            <p className="mt-0.5 font-bold text-brand">
              {quote.netFen === null ? "待称重" : `¥${formatYuan(quote.netFen)}`}
            </p>
          </div>
        </div>
        {quote.range ? (
          <p className="mono mt-2 text-[11px] text-dim">
            参考区间 ¥{formatYuan(quote.range.lowFen)}–¥{formatYuan(quote.range.highFen)}
          </p>
        ) : null}
      </div>

      {/* ⑥ 待确认项 / 估算假设 */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="panel p-5 sm:p-6">
          <h3 className="text-lg font-black tracking-tight">待确认项</h3>
          {quote.unresolved.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {quote.unresolved.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-dim">当前没有额外待确认项；最终仍以现场验车为准。</p>
          )}
        </div>

        <div className="panel p-5 sm:p-6">
          <h3 className="text-lg font-black tracking-tight">估算假设</h3>
          <ul className="mt-3 space-y-2.5">
            {quote.assumptions.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
                <span className="text-dim">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ⑦ 办理建议 + CTA */}
      <div className="panel mt-5 p-5 sm:p-6">
        <h3 className="text-lg font-black tracking-tight">办理建议</h3>
        <ol className="mt-3 space-y-3">
          {[
            "先核对 VIN 与行驶证一致；车值区间会随整备质量和档位变化。",
            "交车前清空车内物品，随车带好行驶证、机动车登记证书与号牌。",
            "现场验车与地磅称重后按实际吨位、缺件和轮毂材质结算。",
          ].map((text, index) => (
            <li key={text} className="flex gap-3">
              <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-line-strong bg-raise/60 p-4">
        <p className="text-xs leading-relaxed text-dim">
          <span className="font-semibold text-text">说明：</span>
          本报告只凭 VIN 车型档案与回收企业价目表估算，未验车、未称重，不采集证件，
          不构成实际收购报价。实际办理以《报废机动车回收管理办法》及现场验车结果为准。
        </p>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-panel/95 backdrop-blur print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-live="polite"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-dim">
              <span className="lamp breathe text-brand" aria-hidden />
              预计到手
            </p>
            <p className="mt-0.5 truncate text-[11px] text-dim">
              {options.towMode === "self" ? "自行送车" : "上门拖车"} ·{" "}
              {options.wheelType === "alloy" ? "铝合金轮毂（默认）" : "铁轮毂"} ·{" "}
              {options.partsConfirmed ? "部件齐全" : "缺件未核对"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="mono text-2xl font-black leading-tight tracking-tight sm:text-[28px]">
              {quote.netFen === null ? "待称重" : `¥${formatYuan(quote.netFen)}`}
            </p>
            <p className="mono text-[10px] text-dim">
              {quote.range
                ? `区间 ¥${formatYuan(quote.range.lowFen)}–¥${formatYuan(quote.range.highFen)}`
                : "整备质量缺失"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-brand text-white">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="mono text-[10px] tracking-[0.16em] text-white/70">
              办理推荐联系人
            </p>
            <p className="mt-1 text-xl font-black tracking-tight">何先生</p>
            <p className="mt-1 text-sm text-white/80">报废回收 · 上门验车 · 手续代办</p>
          </div>
          <div className="flex flex-wrap items-end gap-4 sm:flex-nowrap sm:items-center sm:gap-6">
            <div className="flex flex-col gap-2 sm:items-end">
              <a
                href="tel:15828996681"
                className="mono text-xl font-black tracking-wide hover:underline sm:text-2xl"
              >
                158 2899 6681
              </a>
              <a
                href="tel:15828996681"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-white px-6 text-sm font-bold text-brand transition-colors hover:bg-brand-soft"
              >
                拨打电话
              </a>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <div className="rounded-xl bg-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wechat-he.jpg"
                  alt="何先生微信二维码，扫码添加好友"
                  width={132}
                  height={132}
                  className="h-[104px] w-[104px] rounded-md object-contain sm:h-[132px] sm:w-[132px]"
                />
              </div>
              <p className="text-[10px] font-semibold text-white/80">微信扫码添加</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}