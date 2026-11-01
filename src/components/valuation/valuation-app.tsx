"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReportView } from "@/components/valuation/report-view";
import { type ValuationReport } from "@/lib/valuation/engine";
import { validateVin } from "@/lib/vin/normalize";

type Status = "idle" | "analyzing" | "done";
type Mode = "vin" | "license";

const EXAMPLE_VIN = "LSVAA49J5C2345678";

const VIN_STEPS = ["校验 VIN 格式", "查询车辆档案", "匹配四川回收行情", "生成残值评估报告"];
const PHOTO_STEPS = ["读取行驶证照片", "识别车辆与排量", "匹配四川回收行情", "生成残值评估报告"];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ValuationApp() {
  const [mode, setMode] = useState<Mode>("vin");
  const [vin, setVin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ValuationReport | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const vinRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const vinValid = useMemo(() => validateVin(vin).ok, [vin]);
  const canSubmitVin = vin.trim().length > 0;
  const steps = mode === "vin" ? VIN_STEPS : PHOTO_STEPS;

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (status !== "analyzing") return;
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }, 620);
    return () => window.clearInterval(timer);
  }, [status, steps.length]);

  const clearResult = useCallback(() => {
    setError(null);
    setReport(null);
    setStatus("idle");
  }, []);

  const pickFile = useCallback(
    (next: File | null) => {
      clearResult();
      setIsSample(false);
      if (!next) {
        setFile(null);
        return;
      }
      if (!next.type.startsWith("image/")) {
        setError("请上传行驶证照片（JPG / PNG / HEIC）。");
        return;
      }
      if (next.size > 10 * 1024 * 1024) {
        setError("照片超过 10MB，请压缩后重试。");
        return;
      }
      setFile(next);
    },
    [clearResult],
  );

  const loadSample = useCallback(async () => {
    clearResult();
    try {
      const response = await fetch("/sample-driving-license.svg");
      if (!response.ok) throw new Error("sample");
      const blob = await response.blob();
      const sample = new File([blob], "行驶证-示例.svg", { type: "image/svg+xml" });
      setFile(sample);
      setIsSample(true);
    } catch {
      setError("示例照片加载失败，请手动选择一张照片。");
    }
  }, [clearResult]);

  const runRequest = useCallback(
    async (makeRequest: () => Promise<Response>) => {
      if (status === "analyzing") return;
      setStatus("analyzing");
      setStep(0);
      setError(null);
      setReport(null);

      const startedAt = Date.now();
      try {
        const response = await makeRequest();
        const payload = (await response.json()) as
          | { ok: true; report: ValuationReport }
          | { ok: false; error: string };
        const wait = Math.max(0, 1600 - (Date.now() - startedAt));
        if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));

        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "评估失败" : payload.error);
        }
        setReport(payload.report);
        setStatus("done");
        window.setTimeout(() => {
          reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      } catch (caught) {
        setStatus("idle");
        setError(
          caught instanceof Error && caught.message ? caught.message : "评估失败，请稍后重试。",
        );
      }
    },
    [status],
  );

  const submitVin = useCallback(() => {
    const validation = validateVin(vin);
    if (!validation.ok) {
      setError(validation.message);
      vinRef.current?.focus();
      return;
    }
    void runRequest(() =>
      fetch("/api/valuation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      }),
    );
  }, [runRequest, vin]);

  const submitPhoto = useCallback(() => {
    if (!file) {
      setError("请先选择一张行驶证照片。");
      return;
    }
    void runRequest(() => {
      const body = new FormData();
      body.append("file", file);
      if (isSample) body.append("sample", "1");
      return fetch("/api/valuation/analyze", { method: "POST", body });
    });
  }, [file, isSample, runRequest]);

  const reset = useCallback(() => {
    setFile(null);
    setIsSample(false);
    setReport(null);
    setStatus("idle");
    setError(null);
    if (mode === "vin") vinRef.current?.focus();
    else inputRef.current?.focus();
  }, [mode]);

  const switchMode = (next: Mode) => {
    if (status === "analyzing") return;
    setMode(next);
    setError(null);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-black text-white">
              残
            </span>
            <span className="leading-tight">
              <span className="block text-base font-black tracking-tight">报废残值评估</span>
              <span className="mono block text-[10px] tracking-[0.14em] text-dim">
                SCRAP VALUE · SICHUAN
              </span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-dim sm:inline">输入 VIN · 30 秒出报告</span>
            <a href="#upload" className="btn-primary min-h-[40px] px-4 text-sm">
              开始评估
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <section className="grid items-start gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
          <div>
            <p className="tag border-brand/30 bg-brand-soft text-brand">四川 · 报废残值评估样例</p>
            <h1 className="mt-5 text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl">
              输入 VIN，
              <br />
              看清这辆车
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">报废值多少</span>
                <span aria-hidden className="absolute inset-x-0 bottom-1.5 z-0 h-3 bg-rust/15" />
              </span>
              。
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-dim">
              手动填写车辆识别代号（VIN），或上传行驶证正面自动识别，30 秒生成残值评估报告：
              拆解废钢、三元催化、有色金属等残值，扣掉拆解与拖运成本，给出可参考的收购区间。
            </p>

            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                ["17 位", "VIN 即可评估"],
                ["30 秒", "生成报告"],
                ["6 项", "残值拆解"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <dt className="mono text-lg font-black tracking-tight">{value}</dt>
                  <dd className="mt-0.5 text-xs text-dim">{label}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-8 space-y-2.5 text-sm">
              {[
                "手动输入 VIN 就能评估，不用先拍证件",
                "上传行驶证正面，自动补全号牌与登记日期",
                "报告写清每一项残值怎么算，不藏扣费",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div id="upload" className="scroll-mt-24">
            <div className="panel-strong p-4 sm:p-5">
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-raise p-1" role="tablist" aria-label="评估方式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "vin"}
                  onClick={() => switchMode("vin")}
                  className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${
                    mode === "vin" ? "bg-panel text-text shadow-sm" : "text-dim hover:text-text"
                  }`}
                >
                  输入 VIN
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "license"}
                  onClick={() => switchMode("license")}
                  className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${
                    mode === "license" ? "bg-panel text-text shadow-sm" : "text-dim hover:text-text"
                  }`}
                >
                  上传行驶证
                </button>
              </div>

              {mode === "vin" ? (
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
                      if (event.key === "Enter") submitVin();
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
                    <span className="text-dim">17 位，不含 I / O / Q，第 9 位为校验位</span>
                    <span
                      className={`mono tabular ${
                        vin.length === 0 ? "text-dim" : vinValid ? "text-brand" : "text-warn"
                      }`}
                    >
                      {vin.length}/17
                    </span>
                  </div>
                  <p className="mt-3 rounded-lg bg-raise/70 px-3 py-2 text-[11px] leading-relaxed text-dim">
                    在行驶证「车辆识别代号」栏、前挡风玻璃左下角或机动车登记证书上可以找到。
                    也可以直接点下方示例 VIN 体验。
                  </p>
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
              ) : (
                <div className="pt-1">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="选择行驶证照片"
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      pickFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={`relative flex min-h-[232px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                      dragging
                        ? "border-brand bg-brand-soft"
                        : "border-line-strong bg-raise/50 hover:border-brand/60 hover:bg-brand-soft/40"
                    }`}
                  >
                    {preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview}
                          alt="行驶证预览"
                          className="max-h-[200px] w-auto max-w-full rounded-lg border border-line object-contain shadow-sm"
                        />
                        <p className="mt-2 max-w-full truncate text-xs text-dim">
                          {file?.name} · {file ? formatSize(file.size) : ""}
                        </p>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            pickFile(null);
                          }}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-sm text-dim hover:border-danger hover:text-danger"
                          aria-label="移除照片"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-panel text-brand shadow-sm">
                          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" strokeLinecap="round" />
                          </svg>
                        </span>
                        <p className="mt-3 text-sm font-semibold">拖入照片，或点击选择</p>
                        <p className="mt-1 text-xs text-dim">行驶证正面 · 四角完整 · 文字清晰</p>
                        <p className="mono mt-3 text-[10px] tracking-[0.08em] text-dim">MAX 10MB</p>
                      </>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/svg+xml"
                      className="sr-only"
                      onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadSample}
                    className="mt-2 text-xs font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                  >
                    没有照片？用示例行驶证试试
                  </button>
                </div>
              )}

              {error ? (
                <p role="alert" className="mt-3 rounded-lg bg-danger/8 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={mode === "vin" ? submitVin : submitPhoto}
                disabled={status === "analyzing" || (mode === "vin" ? !canSubmitVin : !file)}
                className="btn-primary mt-3 w-full"
              >
                {status === "analyzing" ? "正在评估…" : "开始评估"}
              </button>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-dim">
                <span>
                  {mode === "vin" ? "VIN 仅用于本次评估" : "照片不保存 · 仅取摘要"}
                </span>
                <button
                  type="button"
                  onClick={() => switchMode(mode === "vin" ? "license" : "vin")}
                  className="font-semibold text-brand"
                >
                  {mode === "vin" ? "改用行驶证识别 →" : "改用手动输入 VIN →"}
                </button>
              </div>

              {status === "analyzing" ? (
                <ul className="mt-4 space-y-2 rounded-xl bg-raise/70 p-3">
                  {steps.map((text, index) => {
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
              VIN 车型档案来自第三方数据服务；残值仍由公开规则测算，用于展示产品形态，不构成实际报价。
            </p>
          </div>
        </section>

        <div ref={reportRef} className="scroll-mt-20">
          {report ? (
            <div className="mt-14">
              {report.dataSource.notice ? (
                <p
                  role="status"
                  className="mb-4 rounded-lg border border-warn/40 bg-warn/8 px-3.5 py-2.5 text-xs leading-relaxed text-warn"
                >
                  {report.dataSource.notice}
                </p>
              ) : null}
              <ReportView report={report} onReset={reset} />
            </div>
          ) : null}
        </div>

        {!report ? (
          <section className="mt-16 grid gap-3 sm:grid-cols-3">
            {[
              ["VIN 在哪", "行驶证「车辆识别代号」栏、前挡风玻璃左下角，共 17 位，不含 I / O / Q。"],
              ["两种输入", "直接填 VIN，或上传行驶证正面；证件能补齐号牌、首次登记日期与使用性质。"],
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
            <span className="font-bold text-text">报废残值评估</span> · 四川地区报废机动车回收服务
          </p>
          <p className="mono text-[10px] tracking-[0.08em]">SAMPLE BUILD · 2026</p>
        </div>
      </footer>
    </div>
  );
}