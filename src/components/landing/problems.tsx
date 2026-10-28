import { SectionHeading } from "./section";

const PROBLEMS = [
  {
    no: "01",
    title: "不知道从哪问起",
    body: "术语一堆，先要填完一张长表单。这里从一句话开始，再逐步确认。",
  },
  {
    no: "02",
    title: "钱看不明白",
    body: "回收款、拖车费、服务费、补贴混在一起。这里逐项拆开，未知费用显示“待确认”，不当成零。",
  },
  {
    no: "03",
    title: "交车不等于办完",
    body: "注销、到账、补贴各有各的状态。这里四条线分开显示，凭证说了算。",
  },
];

export function Problems() {
  return (
    <section
      id="problems"
      aria-labelledby="problems-title"
      className="scroll-mt-32 border-b border-line"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-24 sm:px-6 lg:py-32">
        <SectionHeading
          index="01"
          eyebrow="卡点"
          id="problems-title"
          title="三个常见的卡点"
        />
        <ol className="mt-14 grid gap-px border border-line bg-line lg:grid-cols-3">
          {PROBLEMS.map((item) => (
            <li
              key={item.no}
              className="lift bg-panel p-8 sm:p-10"
            >
              <p className="mono text-5xl font-black tracking-tight text-rust/80">
                {item.no}
              </p>
              <h3 className="mt-8 text-2xl font-black tracking-tight sm:text-3xl">
                {item.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-dim sm:text-lg">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}