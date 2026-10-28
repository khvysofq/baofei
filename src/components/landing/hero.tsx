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
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 -top-56 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(255,106,31,0.18),transparent_64%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(42,46,49,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(42,46,49,0.5)_1px,transparent_1px)] bg-[length:76px_76px] [mask-image:radial-gradient(72%_62%_at_38%_38%,black,transparent)]" />
      </div>

      <div className="relative mx-auto flex min-h-[max(680px,calc(100dvh_-_6rem))] max-w-[1440px] flex-col px-4 pb-8 pt-10 sm:px-6 lg:pt-14">
        <div className="my-auto">
          <p className="label text-rust sm:text-xs">四川 · 汽车报废办理助手</p>

          <h1
            id="hero-title"
            className="mt-6 max-w-[16ch] text-balance text-[clamp(2.05rem,7vw,3.8rem)] font-black leading-[1.04] tracking-tight sm:text-[clamp(3rem,7vw,5rem)] lg:text-[clamp(3.6rem,6.2vw,5.8rem)]"
          >
            <span className="block">报废一辆车</span>
            <span className="block">最怕的是不知道下一步</span>
          </h1>

          <div className="mt-10 max-w-[36rem] lg:mt-14">
            <p className="text-base leading-relaxed text-dim sm:text-lg">
              用一段日常描述开始，系统整理出你的办理计划、要准备的材料、两家演示报价，
              以及每个阶段该看哪张凭证。钱怎么算、什么时候才算办完，一次说清。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/start" className="btn-primary w-full text-base sm:w-auto">
                开始办理演示
              </Link>
              <a href="#how" className="btn-secondary lift w-full text-sm sm:w-auto">
                看看怎么用 ↓
              </a>
            </div>
          </div>
        </div>

        <div className="relative mt-12 w-full max-w-[520px] lg:absolute lg:bottom-24 lg:right-6 lg:mt-0 lg:w-[520px]">
          <VehicleRig />
        </div>

        <ul className="relative mt-10 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {FACTS.map((fact) => (
            <li
              key={fact}
              className="mono bg-void px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-dim sm:text-[11px]"
            >
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}