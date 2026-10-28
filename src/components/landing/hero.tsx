import Link from "next/link";
import { VehicleRig } from "./vehicle-rig";

const FACTS = [
  "演示数据",
  "不采集真实证件",
  "不接政务/企业接口",
  "四川·成都 示例",
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative min-h-[max(680px,calc(100dvh_-_6rem))] overflow-hidden border-b border-line"
    >
      <div className="mx-auto flex min-h-[max(680px,calc(100dvh_-_6rem))] max-w-[1440px] flex-col px-4 pb-8 pt-10 sm:px-6 lg:pt-16">
        <div className="my-auto grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-10 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-12">
          <div className="min-w-0">
            <p className="label text-rust sm:text-xs">
              四川 · 汽车报废办理助手
            </p>

            <h1
              id="hero-title"
              className="mt-5 text-[clamp(2rem,8.8vw,3.4rem)] font-black leading-[0.95] tracking-tight sm:text-[clamp(3.2rem,7vw,4.8rem)] lg:text-[clamp(3rem,5.7vw,4.8rem)] xl:text-[clamp(4.4rem,6.2vw,7.5rem)]"
            >
              <span className="block">报废一辆车</span>
              <span className="block">最怕的是不知道下一步</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-dim sm:text-lg">
              用一段日常描述开始，系统整理出你的办理计划、要准备的材料、两家演示报价，
              以及每个阶段该看哪张凭证。钱怎么算、什么时候才算办完，一次说清。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/start" className="btn-primary w-full text-base sm:w-auto">
                开始办理演示
              </Link>
              <a
                href="#how"
                className="btn-secondary lift w-full text-sm sm:w-auto"
              >
                看看怎么用 ↓
              </a>
            </div>
          </div>

          <div className="lg:justify-self-end">
            <VehicleRig />
          </div>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {FACTS.map((fact) => (
            <li
              key={fact}
              className="mono bg-void px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-dim sm:text-[11px]"
            >
              <span className="mr-2 inline-block h-1.5 w-1.5 bg-rust align-middle" aria-hidden />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}