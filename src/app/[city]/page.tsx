import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CityExamples } from "@/components/city/city-examples";
import { CityVinForm } from "@/components/city/city-vin-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  CITIES,
  CITY_BY_SLUG,
  REGION_NOTE,
  citiesByRegion,
} from "@/lib/seo/cities";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

/** 已知城市在构建期静态生成；未知 slug 走 notFound() 返回 404，不会产生软 404。 */
export function generateStaticParams() {
  return CITIES.map((city) => ({ city: city.slug }));
}

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = CITY_BY_SLUG.get(slug);
  // 在元数据阶段就 404，避免流式渲染先把 200 状态码发出去（软 404）。
  if (!city) notFound();

  const title = `${city.name}报废车回收价格查询｜输入 VIN 免费估价`;
  const description = `${city.name}（${city.plate}）报废车参考收购价查询：输入 17 位 VIN，30 秒估算车值与到手区间，含缺件、拖运、服务费扣减。无需登录，不采集个人信息。`;

  return {
    title,
    description,
    alternates: { canonical: `/${city.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE}/${city.slug}`,
      siteName: "报废车参考收购价",
      locale: "zh_CN",
      type: "website",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: `${city.name}报废车参考收购价查询`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

const STEPS = [
  ["输入 VIN", "在下方填 17 位车辆识别代号，系统先按 GB 16735 校验格式与校验位。"],
  ["读取车型", "按 VIN 取回车系、年款与整备质量，整备质量缺失时不给总价，提示现场称重。"],
  ["算车值", "车型档位吨价 × 整备质量，得出车值，再单独扣缺件、拖运与服务费。"],
  ["定方案", "拿到参考区间后预约回收企业验车、称重，现场确认后再签协议、交车。"],
] as const;

const MATERIALS = [
  "机动车行驶证",
  "机动车登记证书（俗称绿本）",
  "车辆号牌（前后两块，有遗失需先说明）",
  "车主身份证明；单位车辆另附营业执照与经办人委托书",
  "营运车辆还需先办理道路运输证注销",
] as const;

export default async function CityPage({ params }: PageProps) {
  const { city: slug } = await params;
  const city = CITY_BY_SLUG.get(slug);
  if (!city) notFound();

  const nearby = citiesByRegion(city.region, city.slug);

  const faq = [
    {
      q: `${city.name}的报废车能卖多少钱？`,
      a: `按车型档位吨价乘以整备质量算出车值，再扣缺件、拖运与服务费，得到参考到手区间。同一台车在${city.name}不同回收企业之间的报价会有差异，建议至少对比两家。`,
    },
    {
      q: "只填 VIN 就能确定价格吗？",
      a: "不能。VIN 只能取到车型档案与整备质量，属于估算。最终价格要现场验车、地磅称重、确认缺件后才能确定。",
    },
    {
      q: `车籍在${city.name}，车在外地能报废吗？`,
      a: `车辆可以拖到有资质的回收拆解企业处理，注销登记仍要向车辆登记地（${city.name}）的公安机关交通管理部门申请，具体异地办理要求以当地受理窗口为准。`,
    },
    {
      q: "需要准备哪些材料？",
      a: "行驶证、机动车登记证书、车辆号牌、车主身份证明；单位车辆另附营业执照和委托书。营运车辆要先注销道路运输证。",
    },
    {
      q: "多久能办完注销？",
      a: "交车后回收企业出具《报废机动车回收证明》，注销登记进度以交管部门受理为准，不承诺固定天数；期间可用回收证明办理后续业务。",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: SITE },
          {
            "@type": "ListItem",
            position: 2,
            name: `${city.name}报废车估价`,
            item: `${SITE}/${city.slug}`,
          },
        ],
      },
      {
        "@type": "Service",
        name: `${city.name}报废车参考收购价查询`,
        serviceType: "报废机动车回收信息咨询",
        provider: {
          "@type": "Organization",
          name: "报废车参考收购价",
          url: SITE,
        },
        areaServed: {
          "@type": "City",
          name: city.name,
          containedInPlace: { "@type": "AdministrativeArea", name: "四川省" },
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CNY",
          description: "免费 VIN 参考估价",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
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
            <span className="text-text">{city.name}报废车估价</span>
          </nav>

          <div className="mt-4 grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-12">
            <div>
              <p className="tag border-brand/30 bg-brand-soft text-brand">
                四川 · {city.name} · {city.plate}
              </p>
              <h1 className="mt-4 text-3xl font-black leading-[1.18] tracking-tight sm:text-4xl">
                {city.name}报废车回收价格查询
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-dim">
                {city.intro}
                输入 17 位车辆识别代号（VIN），按当地回收行情与整备质量估算车值，
                再扣缺件、拖运与服务费，给出参考到手区间。只凭 VIN 估算，未验车。
              </p>

              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  `只填 VIN，不需要上传证件或行驶证照片`,
                  `${city.name}（${city.plate}）号牌车辆按当地行情估`,
                  "车值与扣减分开列，拖运费单独标出，不藏费用",
                ].map((text) => (
                  <li key={text} className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden
                    />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div id="vin-input" className="scroll-mt-24">
              <CityVinForm cityName={city.name} />
            </div>
          </div>

          <section className="mt-14">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              {city.name}报废车办理流程
            </h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="panel p-4">
                  <p className="mono text-[10px] tracking-[0.14em] text-rust">
                    STEP 0{index + 1}
                  </p>
                  <h3 className="mt-1.5 text-sm font-black">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-dim">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              在{city.name}报废要准备的材料
            </h2>
            <p className="mt-2 text-sm text-dim">
              材料齐全能少跑一趟；缺登记证书或行驶证的，先跟回收企业说明，由他们协助走补办流程。
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {MATERIALS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 rounded-lg border border-line bg-panel px-3 py-2.5 text-sm"
                >
                  <span className="mono text-[11px] text-brand" aria-hidden>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              {city.name}本地办理要点
            </h2>
            <ul className="mt-4 space-y-3">
              {city.notes.map((note) => (
                <li key={note} className="panel p-4 text-sm leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg border border-line bg-raise/60 p-4 text-sm leading-relaxed text-dim">
              {REGION_NOTE[city.region]}
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              {city.name}常见车型参考区间
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dim">
              下表按当前价目表和{city.name}所在的{city.region}片区典型拖运里程估算，
              用来看量级。具体到某台车，还是要输 VIN 才能算准整备质量与车型档位。
            </p>
            <div className="mt-4">
              <Suspense
                fallback={
                  <div className="panel p-4 text-sm text-dim">正在读取当前价目表…</div>
                }
              >
                <CityExamples city={city} />
              </Suspense>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              常见问题
            </h2>
            <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-panel">
              {faq.map((item) => (
                <details key={item.q} className="group p-4">
                  <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="mono text-[10px] text-dim group-open:hidden">+</span>
                    <span className="mono hidden text-[10px] text-dim group-open:inline">−</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-dim">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">
              {city.region}片区其他城市
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nearby.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${item.slug}`}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-line bg-panel px-3 text-sm hover:border-line-strong hover:text-brand"
                  >
                    {item.name}
                    <span className="mono ml-1.5 text-[10px] text-dim">{item.plate}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-dim">
              也可以直接回
              <Link href="/" className="mx-1 text-brand underline underline-offset-4">
                首页
              </Link>
              按 VIN 估算，全省统一算法，与城市无关的部分不会因为换页面而变化。
            </p>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}