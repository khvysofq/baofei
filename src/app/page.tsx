import type { Metadata } from "next";
import { VisitTracker } from "@/components/analytics/visit-tracker";
import { ValuationApp } from "@/components/valuation/valuation-app";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

const DESCRIPTION =
  "四川报废车回收价格查询：输入 17 位 VIN，免费估算报废车参考收购价区间，含车型档位、整备质量、缺件、拖运与服务费。无需登录，不采集个人信息，仅凭 VIN 估算，不构成实际报价。";

export const metadata: Metadata = {
  title: "四川报废车回收价格查询｜输入 VIN 免费估价",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "四川报废车回收价格查询｜输入 VIN 免费估价",
    description:
      "输入 17 位 VIN，30 秒估算四川报废车参考收购价区间。无需登录，不采集个人信息，免费测试。",
    url: "/",
    siteName: "报废车参考收购价",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "报废车参考收购价：输入 VIN，获取参考区间",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "四川报废车回收价格查询｜输入 VIN 免费估价",
    description:
      "输入 17 位 VIN，30 秒估算四川报废车参考收购价区间。无需登录，不采集个人信息。",
    images: ["/og.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "报废车参考收购价",
      alternateName: "四川报废车回收价格查询",
      inLanguage: "zh-CN",
      description: DESCRIPTION,
    },
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "报废车参考收购价",
      url: SITE,
      areaServed: { "@type": "AdministrativeArea", name: "四川省" },
      telephone: "+86-158-2899-6681",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+86-158-2899-6681",
        contactType: "customer service",
        areaServed: "CN",
        availableLanguage: ["zh-CN"],
      },
    },
    {
      "@type": "Service",
      "@id": `${SITE}/#service`,
      name: "四川报废车回收价格查询",
      serviceType: "报废机动车回收",
      provider: { "@id": `${SITE}/#organization` },
      areaServed: { "@type": "AdministrativeArea", name: "四川省" },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CNY",
        description: "免费 VIN 参考估价",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "VIN 在哪里看？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "行驶证「车辆识别代号」栏、前挡风玻璃左下角，共 17 位，不含 I / O / Q。",
          },
        },
        {
          "@type": "Question",
          name: "报废车参考收购价是怎么算的？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "按车型档位、当地实时回收行情和整备质量计算车值，再扣缺件、拖运与服务费，给出参考到手区间。",
          },
        },
        {
          "@type": "Question",
          name: "查询需要登录或上传证件吗？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "不需要登录，也不采集姓名、手机号或证件照片；只输入 17 位 VIN 即可，免费测试。",
          },
        },
        {
          "@type": "Question",
          name: "估价结果能作为实际报价吗？",
          acceptedAnswer: {
            "@type": "Answer",
            text: "不能。仅凭 VIN 估算，未验车、未称重，实际以现场验车和地磅称重结果为准。",
          },
        },
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <VisitTracker />
      <ValuationApp />
    </>
  );
}