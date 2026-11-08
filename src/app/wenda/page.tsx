import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { QA_PAGES } from "@/lib/seo/qa";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

export const metadata: Metadata = {
  title: "汽车报废常见问题｜吨价、流程、材料、补贴",
  description:
    "报废车多少钱一吨、一辆车能卖多少钱、报废流程怎么走、需要哪些材料、补贴怎么领、异地车牌怎么办——四川车主最常问的 8 个问题，逐条讲清楚。",
  alternates: { canonical: "/wenda" },
  openGraph: {
    title: "汽车报废常见问题｜吨价、流程、材料、补贴",
    description:
      "四川车主最常问的 8 个报废问题：吨价、车值、流程、材料、补贴、异地、VIN、报废车上路。",
    url: `${SITE}/wenda`,
    siteName: "报废车参考收购价",
    locale: "zh_CN",
    type: "website",
  },
};

export default function WendaIndexPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "汽车报废常见问题",
    url: `${SITE}/wenda`,
    inLanguage: "zh-CN",
    hasPart: QA_PAGES.map((page) => ({
      "@type": "Question",
      name: page.question,
      url: `${SITE}/wenda/${page.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
          <nav aria-label="面包屑" className="text-xs text-dim">
            <Link href="/" className="hover:text-brand">
              首页
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-text">常见问题</span>
          </nav>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            汽车报废常见问题
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-dim">
            这些都是车主在电话里最常问的几句话。答案按四川的实际情况写，
            涉及金额的地方只讲结构和量级，具体数字请以估价结果和当年政策为准。
          </p>

          <ul className="mt-8 space-y-3">
            {QA_PAGES.map((page, index) => (
              <li key={page.slug} className="panel p-4">
                <Link href={`/wenda/${page.slug}`} className="group block">
                  <p className="mono text-[10px] tracking-[0.14em] text-rust">
                    Q{String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1.5 text-lg font-black tracking-tight group-hover:text-brand">
                    {page.question}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-dim">
                    {page.shortAnswer[0]}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                    看详细回答
                    <span aria-hidden className="mono">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-xl border border-line bg-panel p-5">
            <h2 className="text-lg font-black tracking-tight">
              想先知道自己这台车值多少？
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              输 17 位 VIN，按当前价目表算出参考到手区间，车值与扣减分开列。
              不需要登录，也不采集手机号。
            </p>
            <Link href="/#vin-input" className="btn-primary mt-4 inline-flex min-h-[44px] px-5">
              去估价
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}