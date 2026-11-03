import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "VIN 在哪里看 · 报废车参考收购价",
  description:
    "车辆识别代号（VIN）在行驶证、前挡风玻璃左下角和机动车登记证书上的位置，以及 17 位规则与校验位说明。",
  robots: { index: false, follow: false },
};

const EXAMPLE_VIN = "LSVAA49J5C2345678";

function CharStrip({ vin }: { vin: string }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex w-max gap-0.5">
        {vin.split("").map((char, index) => {
          const isCheck = index === 8;
          const isYear = index === 9;
          return (
            <span
              key={`${char}-${index}`}
              className={`mono flex h-10 w-7 shrink-0 items-center justify-center border text-sm font-bold ${
                isCheck
                  ? "border-warn bg-warn/10 text-warn"
                  : isYear
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-strong bg-raise text-text"
              }`}
            >
              {char}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function LocationCard({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="mono text-[10px] tracking-[0.14em] text-rust">{step}</p>
      <h2 className="mt-1.5 text-base font-black tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function VinHelpPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-black text-white">
              V
            </span>
            <span className="leading-tight">
              <span className="block text-base font-black tracking-tight">VIN 在哪里看</span>
              <span className="mono block text-[10px] tracking-[0.14em] text-dim">
                VIN GUIDE
              </span>
            </span>
          </Link>
          <Link href="/" className="btn-secondary min-h-[40px] px-4 text-sm">
            返回首页
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-10 sm:px-6">
        <p className="tag border-brand/30 bg-brand-soft text-brand">17 位车辆识别代号</p>
        <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          VIN 在车上和证件上的位置
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-dim">
          车辆识别代号（VIN）是 17 位字母和数字，常见位置有三处。抄写时注意区分数字 0 与字母 O、
          数字 1 与字母 I；VIN 里不会出现 I、O、Q。
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <LocationCard step="01 · 行驶证" title="「车辆识别代号」栏">
            <div className="rounded-lg border border-line-strong bg-raise p-3">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                <span className="text-[10px] font-semibold text-dim">中华人民共和国机动车行驶证</span>
                <span className="h-5 w-7 rounded-sm bg-brand/15" aria-hidden />
              </div>
              <dl className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-dim">号牌号码</dt>
                  <dd className="mono text-text">川A·•••••</dd>
                </div>
                <div className="flex gap-2 rounded bg-panel px-1.5 py-1 outline outline-2 outline-warn/60">
                  <dt className="w-16 shrink-0 text-warn">车辆识别代号</dt>
                  <dd className="mono font-bold text-text">{EXAMPLE_VIN}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-dim">发动机号码</dt>
                  <dd className="mono text-text">••••••••</dd>
                </div>
              </dl>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-dim">
              行驶证正本与副本都会印 VIN，最稳妥的是核对正本。
            </p>
          </LocationCard>

          <LocationCard step="02 · 车上" title="前挡风玻璃左下角">
            <div className="rounded-lg border border-line-strong bg-raise p-3">
              <div className="flex h-28 items-end gap-1 rounded-md border border-line bg-panel p-2">
                <div className="h-14 w-5 rounded-t-full bg-line-strong/60" aria-hidden />
                <div className="h-20 flex-1 rounded-t-2xl bg-brand/10" aria-hidden />
                <div className="h-14 w-5 rounded-t-full bg-line-strong/60" aria-hidden />
              </div>
              <div className="mt-2 flex items-center gap-2 rounded bg-panel px-2 py-1.5 outline outline-2 outline-warn/60">
                <span className="h-3 w-3 rounded-sm bg-warn" aria-hidden />
                <span className="mono text-[10px] font-bold text-text">{EXAMPLE_VIN}</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-dim">
              站在车外看挡风玻璃左下角（驾驶员一侧），通常能透过玻璃看到一小条 VIN。
            </p>
          </LocationCard>

          <LocationCard step="03 · 登记证书" title="机动车登记证书">
            <div className="rounded-lg border border-line-strong bg-raise p-3">
              <div className="rounded-md border border-line bg-panel p-2.5">
                <p className="text-[10px] font-semibold text-dim">机动车登记证书</p>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 text-dim">机动车</span>
                    <span className="mono text-text">••••••••</span>
                  </div>
                  <div className="flex gap-2 rounded bg-raise px-1.5 py-1 outline outline-2 outline-warn/60">
                    <span className="w-14 shrink-0 text-warn">车架号</span>
                    <span className="mono font-bold text-text">{EXAMPLE_VIN}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 text-dim">登记日期</span>
                    <span className="mono text-text">••••-••-••</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-dim">
              登记证书（绿本）上也会记录 VIN，找不到行驶证时可查绿本。
            </p>
          </LocationCard>
        </section>

        <section className="panel mt-6 p-5 sm:p-6">
          <h2 className="text-lg font-black tracking-tight">17 位怎么读</h2>
          <p className="mt-1 text-xs text-dim">
            以示例 VIN 为例：蓝色为年份位，橙色为第 9 位校验位。
          </p>
          <div className="mt-4">
            <CharStrip vin={EXAMPLE_VIN} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="tag">第 1–3 位：世界制造厂识别代号</span>
            <span className="tag">第 4–8 位：车辆特征</span>
            <span className="tag border-warn/40 text-warn">第 9 位：校验位（0–9 或 X）</span>
            <span className="tag border-brand/40 text-brand">第 10 位：年份代码</span>
            <span className="tag">第 11–17 位：生产线与顺序号</span>
          </div>
          <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            {[
              "一共 17 位，数字和字母都可能出现。",
              "不会出现字母 I、O、Q，避免与数字 1、0 混淆。",
              "第 9 位是校验位，只能是 0–9 或 X；填写时不要漏掉或改动。",
              "第 10 位是年份代码，同一个字符 30 年循环一次。",
              "如果输入后提示校验位不匹配，先逐位核对行驶证，不要自行改字符。",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel mt-6 p-5 sm:p-6">
          <h2 className="text-lg font-black tracking-tight">示例 VIN</h2>
          <p className="mono mt-2 break-all text-base font-bold tracking-[0.12em]">
            {EXAMPLE_VIN}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-dim">
            这是一辆演示用大众轿车 VIN，可直接回首页填入体验报告。真实报价请使用自己车辆的 VIN。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/" className="btn-primary text-sm">
              回首页输入 VIN
            </Link>
            <Link href="/#vin-input" className="btn-secondary text-sm">
              直接去估价
            </Link>
          </div>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-dim">
          抄写 VIN 时建议直接从行驶证逐位核对，不要凭记忆。VIN 只用于查询车型档案与本次估价。
        </p>
      </main>
    </div>
  );
}