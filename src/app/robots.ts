import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

/**
 * 站点只保留 VIN 估价（首页）与管理后台。
 * 旧办理流程页面已在 2026-11-08 从代码中删除，无需再写进 disallow。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/guanli"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}