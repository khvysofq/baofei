import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CityVinForm } from "@/components/city/city-vin-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { QA_BY_SLUG, QA_PAGES } from "@/lib/seo/qa";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

export function generateStaticParams() {
  return QA_PAGES.map((page) => ({ slug: page.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = QA_BY_SLUG.get(slug);
  // 在元数据阶段就 404，避免流式渲染先把 200 状态码发出去（软 404）。
  if (!page) notFound();

  const description = page.shortAnswer[0];
  return {
    title: `${page.question}｜四川报废车参考收购价`,
    description,
    alternates: { canonical: `/wenda/${page.slug}` },
    openGraph: {
      title: `${page.question}｜四川报废车参考收购价`,
      description,
      url: `${SITE}/wenda/${page.slug}`,
      siteName: "报废车参考收购价",
      locale: "zh_CN",
      type: "article",
    },
  };
}

export default async function QaPage({ params }: PageProps) {
  const { slug } = await params;
  const page = QA_BY_SLUG.get(slug);
  if (!page) notFound();

  const related = page.related
    .map((item) => QA_BY_SLUG.get(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const answerText = [
    ...page.shortAnswer,
    ...page.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
    ]),
  ].join("\n");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: SITE },
          { "@type": "ListItem", position: 2, name: "常见问题", item: `${SITE}/wenda` },
          {
            "@type": "ListItem",
            position: 3,
            name: page.question,
            item: `${SITE}/wenda/${page.slug}`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: page.question,
            acceptedAnswer: { "@type": "Answer", text: answerText },
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
          <nav aria-label="面包屑" className="text-xs text-dim">
            <Link href="/" className="hover:text-brand">
              首页
            </Link>
            <span className="mx-1.5">/</span>
            <Link href="/wenda" className="hover:text-brand">
              常见问题
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-text">{page.question}</span>
          </nav>

          <div className="mt-4 grid items-start gap-10 lg:grid-cols-[1fr_400px] lg:gap-12">
            <article>
              <h1 className="text-3xl font-black leading-[1.2] tracking-tight sm:text-4xl">
                {page.question}
              </h1>

              <div className="mt-5 rounded-xl border border-brand/25 bg-brand-soft/60 p-4">
                {page.shortAnswer.map((text) => (
                  <p key={text} className="text-[15px] leading-relaxed first:mt-0 [&+&]:mt-2.5">
                    {text}
                  </p>
                ))}
              </div>

              {page.sections.map((section) => (
                <section key={section.heading} className="mt-8">
                  <h2 className="text-xl font-black tracking-tight">{section.heading}</h2>
                  {section.paragraphs?.map((text) => (
                    <p key={text} className="mt-3 text-[15px] leading-relaxed text-dim">
                      {text}
                    </p>
                  ))}
                  {section.bullets ? (
                    <ul className="mt-3 space-y-2">
                      {section.bullets.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 rounded-lg border border-line bg-panel px-3 py-2.5 text-sm leading-relaxed"
                        >
                          <span className="mono mt-0.5 text-[11px] text-brand" aria-hidden>
                            ·
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}

              <p className="mt-8 text-xs leading-relaxed text-dim">
                本文按四川的实际情况整理，写的是通行规则；各地受理口径可能不同，最终以办理窗口和当年政策为准。
              </p>
            </article>

            <aside className="lg:sticky lg:top-6">
              <div id="vin-input" className="scroll-mt-24">
                <CityVinForm cityName="四川" />
              </div>

              {related.length ? (
                <div className="mt-5 panel p-4">
                  <p className="text-xs font-bold text-text">相关问答</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {related.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/wenda/${item.slug}`}
                          className="text-dim hover:text-brand"
                        >
                          {item.question}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 panel p-4">
                <p className="text-xs font-bold text-text">按城市查</p>
                <p className="mt-2 text-xs leading-relaxed text-dim">
                  看过问答，可以直接看你所在市州的落地页，里面有本地办理要点。
                </p>
                <Link
                  href="/#city-list"
                  className="mt-3 inline-flex min-h-[40px] items-center text-sm font-semibold text-brand"
                >
                  选择城市
                  <span aria-hidden className="mono ml-1">
                    →
                  </span>
                </Link>
              </div>
            </aside>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}