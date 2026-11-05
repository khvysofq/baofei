import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 后台与接口不参与收录；早期演示页面也不进入索引，避免稀释主页面。
        disallow: [
          "/api/",
          "/guanli",
          "/start",
          "/plan",
          "/documents",
          "/quotes",
          "/appointment",
          "/case",
          "/subsidy",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}