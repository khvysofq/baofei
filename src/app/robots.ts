import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

/**
 * 收录策略：
 * - 首页与 /start（有独立静态内容）放开收录。
 * - 后台 /guanli、接口 /api/ 永远不收录。
 * - /plan /documents /quotes /appointment /case /subsidy 是依赖案件状态的流程页，
 *   无案件时只渲染空状态，放出去会产生重复标题的低质页，因此暂不收录；
 *   等它们各自具备独立静态内容后再放开（见 docs/seo.md）。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/guanli",
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