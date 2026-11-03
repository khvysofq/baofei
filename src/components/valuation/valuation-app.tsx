"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReportView } from "@/components/valuation/report-view";
import type { VinQuoteReport } from "@/lib/valuation/pricing";
import { validateVin } from "@/lib/vin/normalize";

type Status = "idle" | "analyzing" | "done";

const EXAMPLE_VIN = "LSVAA49J5C2345678";
const STEPS = ["校验 VIN 格式", "查询车型档案", "读取吨价表", "生成参考区间"];

function isVinQuoteReport(value: unknown): value is VinQuoteReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "vehicle" in value &&
    "quote" in value &&
    "pricing" in value
  );
}

export function ValuationApp() {
  const [vin, setVin] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [report, setReport] = useState<VinQuoteReport | null>(null);
  const vinRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const vinValid = useMemo(() => validateVin(vin).ok, [vin]);
  const canSubmit = vin.trim().length > 0 && status !== "analyzing";

  useEffect(() => {
    if (status !== "analyzing") return;
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 620);
    return () => window.clearInterval(timer);
  }, [status]);

  const reset = useCallback(() => {
    setReport(null);
    setError(null);
    setNotice(null);
    setStatus("idle");
    vinRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (status === "analyzing") return;
    const validation = validateVin(vin);
    if (!validation.ok) {
      setError(validation.message);
      setNotice(null);
      vinRef.current?.focus();
      return;
    }

    setStatus("analyzing");
    setStep(0);
    setError(null);
    setNotice(null);
    setReport(null);

    const startedAt = Date.now();
    try {
      const response = await fetch("/api/valuation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const payload = (await response.json()) as
        | { ok: true; report: VinQuoteReport }
        | { ok: false; error?: string; code?: string };

      const wait = Math.max(0, 1200 - (Date.now() - startedAt));
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));

      if (!response.ok || !payload.ok || !isVinQuoteReport(payload.report)) {
        const message =
          !payload.ok && payload.error
            ? payload.error
            : "估价失败，请稍后重试。";
        throw new Error(message);
      }

      setReport(payload.report);
      setNotice(payload.report.dataSource.notice);
      setStatus("done");
      window.setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (caught) {
      setStatus("idle");
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "估价失败，请稍后重试。",
      );
    }
  }, [status, vin]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-black text-white">
              收
            </span>
            <span className="leading-tight">
              <span className="block text-base font-black tracking-tight">报废车参考收购价</span>
              <span className="mono block text-[10px] tracking-[0.14em] text-dim">
                VIN QUOTE · SICHUAN
              </span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-dim sm:inline">只填 VIN · 30 秒出区间</span>
            <a href="#vin-input" className="btn-primary min-h-[40px] px-4 text-sm">
              开始估价
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <section className="grid items-start gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
          <div>
            <p className="tag border-brand/30 bg-brand-soft text-brand">四川 · 报废车参考收购价</p>
            <h1 className="mt-5 text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl">
              输入 VIN，
              <br />
              估个
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">参考收购价</span>
                <span aria-hidden className="absolute inset-x-0 bottom-1.5 z-0 h-3 bg-rust/15" />
              </span>
              。
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-dim">
              填写 17 位车辆识别代号（VIN），按回收企业吨价表和整备质量估算车值，
              再扣缺件、拖运与服务费，给出参考到手区间。只凭 VIN 估算，未验车。
            </p>

            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                ["17 位", "VIN 即可估价"],
                ["30 秒", "生成参考区间"],
                ["按吨", "统一吨价表"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <dt className="mono text-lg font-black tracking-tight">{value}</dt>
                  <dd className="mt-0.5 text-xs text-dim">{label}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-8 space-y-2.5 text-sm">
              {[
                "只填 VIN，不需要上传证件或照片",
                "车值与扣减分开列，不藏费用",
                "铁轮毂、缺件、拖运可在报告里切换，价格即时重算",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div id="vin-input" className="scroll-mt-24">
            <div className="panel-strong p-4 sm:p-5">
              <div className="pt-1">
                <label htmlFor="vin" className="text-sm font-semibold">
                  车辆识别代号（VIN）
                </label>
                <input
                  ref={vinRef}
                  id="vin"
                  value={vin}
                  onChange={(event) => {
                    setVin(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17));
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submit();
                  }}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder={EXAMPLE_VIN}
                  aria-invalid={vin.length > 0 && !vinValid}
                  aria-describedby="vin-hint"
                  className="input mono mt-2 h-14 text-lg tracking-[0.12em] uppercase"
                />
                <div id="vin-hint" className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-dim">
                    17 位，不含 I / O / Q，第 9 位为校验位 ·{" "}
                    <Link href="/vin-help" className="font-semibold text-brand underline decoration-brand/40 underline-offset-4">
                      找不到 VIN？看这里
                    </Link>
                  </span>
                  <span
                    className={`mono tabular ${
                      vin.length === 0 ? "text-dim" : vinValid ? "text-brand" : "text-warn"
                    }`}
                  >
                    {vin.length}/17
                  </span>
                </div>

                <div className="mt-3 rounded-lg bg-raise/70 px-3 py-2 text-[11px] leading-relaxed text-dim">
                  在行驶证「车辆识别代号」栏、前挡风玻璃左下角或机动车登记证书上可以找到。
                  也可以直接点下方示例 VIN 体验。
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVin(EXAMPLE_VIN);
                    setError(null);
                  }}
                  className="mt-2 text-xs font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                >
                  填入示例 VIN（大众轿车）
                </button>
              </div>

              {error ? (
                <div role="alert" className="mt-3 rounded-lg bg-danger/8 px-3 py-2 text-xs text-danger">
                  <p>{error}</p>
                  <Link
                    href="/vin-help"
                    className="mt-1 inline-block font-semibold underline decoration-danger/40 underline-offset-4"
                  >
                    核对 VIN 位置与写法 →
                  </Link>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="btn-primary mt-3 w-full"
              >
                {status === "analyzing" ? "正在估价…" : "获取参考收购价"}
              </button>
              <p className="mt-2 text-[10px] text-dim">
                VIN 仅用于本次估价；车型档案来自第三方数据服务，参考价不构成实际报价。
              </p>

              {status === "analyzing" ? (
                <ul className="mt-4 space-y-2 rounded-xl bg-raise/70 p-3">
                  {STEPS.map((text, index) => {
                    const state = index < step ? "done" : index === step ? "active" : "waiting";
                    return (
                      <li key={text} className="flex items-center gap-2 text-xs">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                            state === "done"
                              ? "border-brand bg-brand text-white"
                              : state === "active"
                                ? "border-brand text-brand breathe"
                                : "border-line-strong text-dim"
                          }`}
                          aria-hidden
                        >
                          {state === "done" ? "✓" : "·"}
                        </span>
                        <span className={state === "waiting" ? "text-dim" : "font-semibold"}>
                          {text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <p className="mt-3 px-1 text-[11px] leading-relaxed text-dim">
              VIN 车型档案来自第三方数据服务；收购价按公开价目表测算，用于展示产品形态，
              不构成实际报价。实际办理以现场验车与地磅称重为准。
            </p>
          </div>
        </section>

        <div ref={reportRef} className="scroll-mt-20">
          {report ? (
            <div className="mt-14">
              {notice ? (
                <p
                  role="status"
                  className="mb-4 rounded-lg border border-warn/40 bg-warn/8 px-3.5 py-2.5 text-xs leading-relaxed text-warn"
                >
                  {notice}
                </p>
              ) : null}
              <ReportView key={report.vehicle.vin} report={report} onReset={reset} />
            </div>
          ) : null}
        </div>

        {!report ? (
          <section className="mt-16 grid gap-3 sm:grid-cols-3">
            {[
              ["VIN 在哪", "行驶证「车辆识别代号」栏、前挡风玻璃左下角，共 17 位，不含 I / O / Q。"],
              ["怎么估价", "车型档位 × 吨价 × 整备质量，再扣缺件、拖运与服务费；车值与扣减分开列。"],
              ["下一步做什么", "确认区间后预约回收企业上门验车，现场称重并出具《报废机动车回收证明》。"],
            ].map(([title, text], index) => (
              <div key={title} className="panel p-4">
                <p className="mono text-[10px] tracking-[0.14em] text-rust">STEP 0{index + 1}</p>
                <h3 className="mt-1.5 text-sm font-black">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-dim">{text}</p>
              </div>
            ))}
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line bg-panel/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-dim sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            <span className="font-bold text-text">报废车参考收购价</span> · 四川地区报废机动车回收服务
          </p>
          <p className="mono text-[10px] tracking-[0.08em]">SAMPLE BUILD · 2026</p>
        </div>
      </footer>
    </div>
  );
}