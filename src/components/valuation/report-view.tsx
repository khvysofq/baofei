"use client";

import { useState } from "react";
import { formatYuan } from "@/lib/domain/money";
import type { ValuationReport } from "@/lib/valuation/engine";
import {
  ACQUISITION_PROVIDER,
  ACQUISITION_VERSION,
  TOW_FREE_KM,
  quoteAcquisition,
  resolveCategory,
} from "@/lib/valuation/acquisition";

const TONE_DOT: Record<string, string> = {
  up: "bg-brand",
  down: "bg-rust",
  flat: "bg-line-strong",
};

function roundToYuan(fen: number): number {
  return Math.round(fen / 1000) * 1000;
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

export function ReportView({
  report,
  onReset,
}: {
  report: ValuationReport;
  onReset: () => void;
}) {
  const [needTowing, setNeedTowing] = useState(true);
  const [wheelType, setWheelType] = useState<"alloy" | "steel">("alloy");
  const maxFen = Math.max(...report.items.map((item) => item.amountFen));
  const { profile } = report;
  const baseMid = needTowing ? report.netMidFen : report.netMidNoTowingFen;
  const wheelDeductionFen = wheelType === "steel" ? report.ironWheelDeductionFen : 0;
  const netMid = roundToYuan(baseMid - wheelDeductionFen);
  const netLow = roundToYuan(netMid * 0.94);
  const netHigh = roundToYuan(netMid * 1.08);
  const fixedDeductionFen = Math.max(0, report.deductionsFen - report.towingFen);

  // 合作方收购价：到厂口径，按价目表分档计价，与上面的残值区间口径不同。
  const acquisitionCategory = resolveCategory({ vehicleType: profile.vehicleType });
  const acquisition = acquisitionCategory
    ? quoteAcquisition({
        category: acquisitionCategory,
        weightKg: profile.curbWeightKg,
        steelRims: wheelType === "steel",
      })
    : null;

  return (
    <section id="report" className="scroll-mt-20 pb-24 print:pb-0 sm:pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-strong pb-4">
        <div>
          <p className="label text-rust">VALUATION REPORT · 残值评估报告</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            {profile.brandModel}
            <span className="mono ml-2 text-lg font-semibold text-dim">
              {profile.plate ?? `VIN ${profile.vin.slice(0, 3)}…${profile.vin.slice(-4)}`}
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <span className="tag text-brand border-brand/40">
            {report.dataSource.kind === "provider"
              ? `${report.dataSource.providerLabel ?? "VIN 渠道"} · 实车数据`
              : report.source === "vin"
                ? "VIN 推定"
                : "行驶证识别"}
          </span>
          {report.dataSource.kind === "provider" ? (
            <span className="tag text-dim">
              {report.dataSource.cached ? "缓存命中" : "实时查询"}
            </span>
          ) : null}
          <span className="tag text-warn">样例报告</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-sm"
          >
            打印 / 存为 PDF
          </button>
          <button type="button" onClick={onReset} className="btn-secondary text-sm">
            重新评估
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="报告编号" value={report.reportNo} />
        <Stat label="出具时间" value={formatDateTime(report.assessedAt)} />
        <Stat label="有效期至" value={`${report.validUntil}（7 天）`} />
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel-strong relative flex flex-col self-start overflow-hidden p-5 sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10"
          />
          <p className="label">
            综合残值区间 · {needTowing ? "含拖运上门" : "自行送车"} ·{" "}
            {wheelType === "alloy" ? "铝合金轮毂" : "铁轮毂"}
          </p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-text">
            <span className="mono text-3xl font-black sm:text-4xl">
              ¥{formatYuan(netLow)}
            </span>
            <span className="text-dim">–</span>
            <span className="mono text-3xl font-black sm:text-4xl">
              ¥{formatYuan(netHigh)}
            </span>
          </p>
          <p className="mt-2 text-sm text-dim">
            中值{" "}
            <span className="mono font-bold text-brand">¥{formatYuan(netMid)}</span>
            ，已扣除拆解{needTowing ? "与拖运" : ""}成本
          </p>

          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dim">毛残值</dt>
              <dd className="mono font-semibold">¥{formatYuan(report.grossFen)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dim">拆解与环保处置</dt>
              <dd className="mono font-semibold text-rust">
                −¥{formatYuan(fixedDeductionFen)}
              </dd>
            </div>
            {needTowing ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-dim">拖运与上门服务</dt>
                <dd className="mono font-semibold text-rust">
                  −¥{formatYuan(report.towingFen)}
                </dd>
              </div>
            ) : null}
            {wheelType === "steel" ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-dim">铁轮毂差价（400 元/吨）</dt>
                <dd className="mono font-semibold text-rust">
                  −¥{formatYuan(report.ironWheelDeductionFen)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dim">车况修正（{report.condition}）</dt>
              <dd className="mono font-semibold">
                {report.conditionAdjustmentFen >= 0 ? "+" : "−"}¥
                {formatYuan(Math.abs(report.conditionAdjustmentFen))}
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-line px-3.5 py-3">
            <p className="label text-[10px]">评估口径</p>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-dim">
              <li>· 整备质量以行驶证为准；仅有 VIN 时按同平台车型推定。</li>
              <li>· 废钢单价取四川地区近期回收区间，现场称重后多退少补。</li>
              <li>· 三元催化按原装件计价，缺件按 10%–15% 扣减。</li>
            </ul>
          </div>

          <div className="mt-5 rounded-xl bg-brand-soft p-3.5">
            <p className="text-xs font-semibold text-brand">
              评估把握度：{report.confidence.level}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-dim">{report.confidence.note}</p>
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-2">
            <h3 className="text-lg font-black tracking-tight">残值构成</h3>
            <span className="mono text-[11px] text-dim">单位：元</span>
          </div>
          <ul className="space-y-3.5">
            {report.items.map((item) => (
              <li key={item.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mono text-sm font-bold">¥{formatYuan(item.amountFen)}</p>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-dim">{item.basis}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-raise">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(4, Math.round((item.amountFen / maxFen) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-line-strong pt-3">
            <p className="text-sm font-bold">毛残值合计</p>
            <p className="mono text-lg font-black">¥{formatYuan(report.grossFen)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5 sm:p-6">
          <h3 className="text-lg font-black tracking-tight">车辆信息</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            {[
              ["号牌号码", profile.plate ?? "未提供"],
              ["车辆类型", profile.vehicleType],
              ["使用性质", profile.useNature + (report.source === "vin" ? "（推定）" : "")],
              ["品牌型号", profile.brandModel],
              ["初次登记", profile.registerDate ?? profile.registerNote ?? "以证件为准"],
              ["车龄", `${report.ageYears} 年`],
              ["整备质量", `${profile.curbWeightKg} kg`],
              ["排量 / 燃料", `${profile.displacementMl} ml · ${profile.fuel}`],
              ["排放标准", profile.emission],
              [
                "数据来源",
                report.dataSource.kind === "provider"
                  ? `${report.dataSource.providerLabel ?? "VIN 渠道"}${
                      report.dataSource.cached ? "（缓存）" : "（实时）"
                    }`
                  : report.source === "vin"
                    ? "规则推定（演示）"
                    : "样例识别",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="label text-[10px]">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
            <div className="flex gap-2">
              <dt className="shrink-0 text-dim">车辆识别代号</dt>
              <dd className="mono">{profile.vin}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-dim">发动机号码</dt>
              <dd className="mono">{profile.engineNo ?? "未提供（上传行驶证可补全）"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-dim">
            {report.dataSource.kind === "provider"
              ? `车型档案由${report.dataSource.providerLabel}于 ${
                  report.dataSource.fetchedAt
                    ? formatDateTime(report.dataSource.fetchedAt)
                    : "近期"
                } 返回；${
                  report.estimatedFields.length > 0
                    ? `${report.estimatedFields.join("、")}为推定或待补项`
                    : "关键参数均来自实车数据"
                }，最终以行驶证与现场验车为准。`
              : report.source === "vin"
                ? `未取到第三方车型档案，本次按 VIN 品牌位与年款位推定；${report.estimatedFields.join("、")}为推定值，上传行驶证后可校准。`
                : "以上字段为样例识别结果，用于演示报告结构；接入 OCR 后显示证件真实字段。"}
          </p>
        </div>

        <div className="panel p-5 sm:p-6">
          <h3 className="text-lg font-black tracking-tight">价格影响因素</h3>
          <ul className="mt-4 space-y-3">
            {report.factors.map((factor) => (
              <li key={factor.label} className="flex gap-2.5">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[factor.tone]}`}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-semibold">{factor.label}</p>
                  <p className="text-[11px] leading-snug text-dim">{factor.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-black tracking-tight">合作方收购价</h3>
            <p className="mt-1 text-xs text-dim">
              回收企业按吨收购的到厂口径，与上方残值区间不是同一算法：残值看「车值多少」，收购价看「按吨能付多少」。
            </p>
          </div>
          <span className="tag shrink-0">
            {ACQUISITION_PROVIDER} · v{ACQUISITION_VERSION}
          </span>
        </div>

        {acquisition ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <dt className="text-dim">车型档位</dt>
                <dd className="font-semibold">{acquisition.categoryLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <dt className="text-dim">计价方式</dt>
                <dd className="mono font-semibold">
                  {acquisition.pricingMode === "unit"
                    ? "按辆计价"
                    : acquisition.fenPerTon === null
                      ? "待确认"
                      : `¥${formatYuan(acquisition.fenPerTon)}/吨 × ${(
                          (acquisition.weightKg ?? 0) / 1000
                        ).toFixed(3)} 吨`}
                </dd>
              </div>
              {acquisition.steelRimDiscount ? (
                <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-dim">铁圈缺失（400 元/吨）</dt>
                  <dd className="mono font-semibold text-rust">已按每吨减 400 元</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <dt className="text-dim">缺件扣款</dt>
                <dd className="mono font-semibold">
                  {acquisition.deductionsFen > 0
                    ? `−¥${formatYuan(acquisition.deductionsFen)}`
                    : "现场验车核定"}
                </dd>
              </div>
            </dl>

            <div className="sm:text-right">
              <p className="label">到厂收购价</p>
              <p className="mono mt-1 text-3xl font-black tracking-tight text-brand">
                {acquisition.netFen === null
                  ? "待确认"
                  : `¥${formatYuan(acquisition.netFen)}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-warn">
            车型不在价目表范围内（当前车型：{profile.vehicleType}），收购价待人工核定。
          </p>
        )}

        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[11px] leading-relaxed text-dim">
          <li>· {TOW_FREE_KM} 公里内免费拖车，超出部分 5 元/公里另计，不含在上述金额中。</li>
          <li>· 缺件按目录逐项扣减：备胎、电瓶、铝圈、线束、水箱冷凝器、启动机发电机压缩机 ABS、电脑板等。</li>
          <li>· 车辆有缺失、事故或发动机变速箱拆散时，改按地磅称重计价。</li>
          {acquisition?.notices.map((notice) => (
            <li key={notice}>· {notice}</li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-tight">报价选项</h3>
              <p className="mt-1 text-xs text-dim">
                选择拖车方式与轮毂材质，上方残值区间会实时调整。
              </p>
            </div>
            <span className="tag shrink-0 text-brand">影响报价</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="是否需要拖车上门">
            <button
              type="button"
              role="radio"
              aria-checked={needTowing}
              onClick={() => setNeedTowing(true)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                needTowing
                  ? "border-brand bg-brand-soft"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                    needTowing
                      ? "border-brand bg-brand text-white"
                      : "border-line-strong text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                需要拖车上门
              </span>
              <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                回收企业上门拖车，费用 ¥{formatYuan(report.towingFen)} 已计入区间
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!needTowing}
              onClick={() => setNeedTowing(false)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                !needTowing
                  ? "border-brand bg-brand-soft"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                    !needTowing
                      ? "border-brand bg-brand text-white"
                      : "border-line-strong text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                不需要，自行送车
              </span>
              <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                自己送到回收网点，评估价增加 ¥{formatYuan(report.towingFen)}
              </span>
            </button>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-sm font-bold">轮毂材质</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="轮毂材质">
              <button
                type="button"
                role="radio"
                aria-checked={wheelType === "alloy"}
                onClick={() => setWheelType("alloy")}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  wheelType === "alloy"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                      wheelType === "alloy"
                        ? "border-brand bg-brand text-white"
                        : "border-line-strong text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  铝合金轮毂（默认）
                </span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                  按当前评估价计价
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={wheelType === "steel"}
                onClick={() => setWheelType("steel")}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  wheelType === "steel"
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                      wheelType === "steel"
                        ? "border-brand bg-brand text-white"
                        : "border-line-strong text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  铁轮毂
                </span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-dim">
                  按整备质量每吨减 400 元，本车约少 ¥{formatYuan(report.ironWheelDeductionFen)}
                </span>
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-dim">
              轮毂差价 = 整备质量 {(report.profile.curbWeightKg / 1000).toFixed(2)} 吨 × 400 元/吨；
              最终以现场验车确认的轮毂材质为准。
            </p>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-dim">
            拖运费按成都绕城内测算；自行送车前请先与回收企业确认网点地址与接收时间。
          </p>
        </div>

        <div className="panel p-5 sm:p-6">
          <h3 className="text-lg font-black tracking-tight">办理建议</h3>
          <ol className="mt-3 space-y-3">
            {report.suggestions.map((text, index) => (
              <li key={text} className="flex gap-3">
                <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-raise/60 p-4">
        <p className="text-xs leading-relaxed text-dim">
          <span className="font-semibold text-text">样例说明：</span>
          {report.dataSource.kind === "provider"
            ? `车辆档案来自${report.dataSource.providerLabel}实时查询；残值由内置规则引擎测算，用于演示“输入 VIN → 残值报告”的产品形态，不构成实际收购报价。实际办理以《报废机动车回收管理办法》及回收企业现场验车结果为准。`
            : "本报告由内置规则引擎生成，用于演示“输入 VIN 或上传行驶证 → 残值报告”的产品形态，不构成实际收购报价。车辆信息为演示数据。实际办理以《报废机动车回收管理办法》及回收企业现场验车结果为准。"}
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
              当前评估价
            </p>
            <p className="mt-0.5 truncate text-[11px] text-dim">
              {needTowing ? "含拖运上门" : "自行送车"} ·{" "}
              {wheelType === "alloy" ? "铝合金轮毂" : "铁轮毂"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="mono text-2xl font-black leading-tight tracking-tight sm:text-[28px]">
              ¥{formatYuan(netMid)}
            </p>
            <p className="mono text-[10px] text-dim">
              区间 ¥{formatYuan(netLow)}–¥{formatYuan(netHigh)}
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