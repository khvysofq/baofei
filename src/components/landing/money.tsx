import { SectionHeading } from "./section";

const QUOTES = [
  {
    name: "成都川鑫再生资源",
    recovery: "¥1,200",
    tow: "−¥200",
    service: "−¥0",
    net: "¥1,000",
  },
  {
    name: "成都蜀通汽车循环",
    recovery: "¥1,100",
    tow: "−¥0",
    service: "−¥50",
    net: "¥1,050",
  },
];

const ROWS = [
  { key: "recovery", label: "回收款" },
  { key: "tow", label: "拖车费" },
  { key: "service", label: "服务费" },
] as const;

export function MoneySection() {
  return (
    <section
      id="money"
      aria-labelledby="money-title"
      className="scroll-mt-32 border-b border-line"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-24 sm:px-6 lg:py-32">
        <SectionHeading
          index="03"
          eyebrow="费用"
          id="money-title"
          title="预计实收，先算给你看"
          intro="预计实收 = 回收款 − 拖车费 − 服务费。费用未知时净额显示“待确认”，不会按 0 计算。补贴单独核实，不计入净额。"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {QUOTES.map((quote) => (
            <article key={quote.name} className="panel p-7 sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mono text-[11px] uppercase tracking-[0.18em] text-dim">
                    合作方报价
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-tight">
                    {quote.name}
                  </h3>
                </div>
                <span className="tag text-warn">
                  预估金额 · 以现场验车为准
                </span>
              </div>

              <dl className="mt-8 divide-y divide-line border-y border-line">
                {ROWS.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <dt className="text-sm text-dim">{row.label}</dt>
                    <dd className="mono tabular text-lg text-text">
                      {quote[row.key]}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                <p className="label">预计实收</p>
                <p className="mono tabular text-5xl font-black leading-none text-rust sm:text-6xl">
                  {quote.net}
                </p>
              </div>
            </article>
          ))}
        </div>

        <p className="mono mt-6 text-[11px] leading-relaxed tracking-[0.08em] text-dim">
          金额为预估口径，实际以现场验车与合同为准。
        </p>
      </div>
    </section>
  );
}