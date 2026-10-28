import Link from "next/link";
import { SectionHeading } from "./section";

const STEPS = [
  {
    no: "01",
    name: "说清情况",
    note: "用日常描述说明车在哪、登记在哪、能不能开。",
  },
  {
    no: "02",
    name: "确认计划",
    note: "核对系统整理的事实，补上还不清楚的字段。",
  },
  {
    no: "03",
    name: "检查材料",
    note: "对照样例检查证件，缺项会生成核对任务。",
  },
  {
    no: "04",
    name: "比较费用",
    note: "逐项拆开回收款与费用，看预计实收。",
  },
  {
    no: "05",
    name: "确认预约",
    note: "选择回收方与时段，核对交接事项。",
  },
  {
    no: "06",
    name: "追踪四条线",
    note: "车辆回收、注销、回收款、补贴分开看凭证。",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-32 border-b border-line"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-24 sm:px-6 lg:py-32">
        <SectionHeading
          index="02"
          eyebrow="流程"
          id="how-title"
          title="一次办理，六步走完"
        />

        <ol className="mt-16 grid gap-10 lg:grid-cols-6 lg:gap-4">
          {STEPS.map((step, index) => (
            <li key={step.no} className="relative min-w-0 pl-14 lg:pl-0 lg:pt-14">
              {index < STEPS.length - 1 && (
                <span
                  className="absolute left-[15px] top-12 bottom-[-2rem] w-px bg-line lg:hidden"
                  aria-hidden
                />
              )}
              <span
                className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center border border-line-strong bg-raise mono text-[11px] text-rust lg:left-0"
                aria-hidden
              >
                {step.no}
              </span>
              {index < STEPS.length - 1 && (
                <span
                  className="absolute left-10 right-[-1rem] top-[15px] hidden h-px bg-line lg:block"
                  aria-hidden
                />
              )}
              <h3 className="text-xl font-black tracking-tight">{step.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-dim sm:text-[15px]">
                {step.note}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex justify-start lg:justify-end">
          <Link href="/start" className="btn-secondary lift text-sm">
            开始 · 约 3 分钟
          </Link>
        </div>
      </div>
    </section>
  );
}