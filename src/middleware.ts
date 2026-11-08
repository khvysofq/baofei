import { NextResponse, type NextRequest } from "next/server";
import { CITY_BY_SLUG } from "@/lib/seo/cities";
import { QA_BY_SLUG } from "@/lib/seo/qa";

/**
 * 未知 slug 在流式渲染（PPR）下会先发出 200 再渲染 notFound 内容，形成软 404。
 * 这里在渲染前就把不存在的路径判成 404，搜索引擎拿到的状态码才是真的。
 *
 * 只拦两类路径：`/<城市>` 与 `/wenda/<问答>`；后台、接口、静态文件都不碰。
 */
const CITY_SLUGS = new Set(CITY_BY_SLUG.keys());
const QA_SLUGS = new Set(QA_BY_SLUG.keys());

const NOT_FOUND_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>页面不存在｜报废车参考收购价</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#f6f7f5;color:#14181a;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
 main{max-width:32rem;padding:2rem}
 p.code{font-size:.75rem;letter-spacing:.14em;color:#c2410c;margin:0 0 .5rem}
 h1{font-size:1.75rem;margin:0 0 .75rem}
 p{margin:.5rem 0;color:#5c6663;line-height:1.7}
 a{display:inline-block;margin-top:1.25rem;padding:.75rem 1.25rem;background:#0f6b57;color:#fff;
  border-radius:.75rem;text-decoration:none;font-weight:700}
</style></head>
<body><main>
<p class="code">404 · NOT FOUND</p>
<h1>这个页面不存在</h1>
<p>链接可能过期，或者城市名写错了。四川 21 个市州的估价页都在首页底部列着。</p>
<a href="/">回首页按 VIN 估价</a>
</main></body></html>`;

function notFoundResponse(): NextResponse {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}

export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);

  if (segments.length === 1 && segments[0] !== "wenda" && !CITY_SLUGS.has(segments[0])) {
    return notFoundResponse();
  }

  if (segments.length === 2 && segments[0] === "wenda" && !QA_SLUGS.has(segments[1])) {
    return notFoundResponse();
  }

  return NextResponse.next();
}

export const config = {
  // 后台、接口、带扩展名的静态文件、Next 内部资源都不经过这里。
  matcher: ["/((?!_next|api|guanli|.*\\..*).*)"],
};