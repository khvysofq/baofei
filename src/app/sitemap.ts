import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/seo/cities";
import { QA_PAGES } from "@/lib/seo/qa";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";
const LAST_MODIFIED = new Date();

/** 首页 + 四川各市州落地页；后台与接口不收录。 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE}/`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...CITIES.map((city) => ({
      url: `${SITE}/${city.slug}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE}/wenda`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...QA_PAGES.map((page) => ({
      url: `${SITE}/wenda/${page.slug}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}