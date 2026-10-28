"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { no: "01", name: "说清情况" },
  { no: "02", name: "确认计划" },
  { no: "03", name: "检查材料" },
  { no: "04", name: "比较费用" },
  { no: "05", name: "确认预约" },
  { no: "06", name: "追踪四条线" },
];

const INTERVAL_MS = 1200; // 6 步 × 1.2s ≈ 8s 一轮（含渲染开销）

export function HeroTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // 减少动效时完全不启动计时器，静态分支由 CSS 接管
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % STEPS.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const step = STEPS[index];

  return (
    <div className="mt-4 border border-line bg-panel/85 px-4 py-3">
      <div className="hidden motion-reduce:block">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-dim">
          流程 · 六步
        </p>
        <p className="mono mt-1 text-[13px] text-text">
          01 说清情况 → 06 追踪四条线
        </p>
      </div>

      <div className="motion-reduce:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-dim">
            PROCESS SIM · 8S LOOP
          </p>
          <p className="mono text-[10px] tabular text-rust">{step.no} / 06</p>
        </div>

        <p className="mt-1 flex items-center gap-2 text-[13px] text-text">
          <span className="text-rust" aria-hidden>
            ▸
          </span>
          {step.name}
        </p>

        <div className="mt-2 h-[3px] w-full bg-line" aria-hidden>
          <div
            className="h-full bg-rust transition-[width] duration-500 ease-out"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}