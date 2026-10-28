import Link from "next/link";

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="border-b border-line">
      <div className="hazard" aria-hidden />
      <div className="mx-auto flex max-w-[1440px] flex-col items-center px-4 py-24 text-center sm:px-6 lg:py-32">
        <p className="label text-rust">READY / DEMO</p>
        <h2
          id="closing-title"
          className="mt-6 text-[clamp(2.25rem,6vw,4.5rem)] font-black leading-[1.02] tracking-tight"
        >
          三分钟走完一次报废。
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-dim">
          从一句话开始。全程演示模式，不采集真实证件，不产生真实法律效力。
        </p>
        <Link href="/start" className="btn-primary mt-9 px-8 text-base">
          进入演示
        </Link>
      </div>
      <div className="hazard" aria-hidden />
    </section>
  );
}