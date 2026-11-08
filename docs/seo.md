# SEO 配置与提交

## 已实现的页面级 SEO

- 首页标题：`四川报废车回收价格查询｜输入 VIN 免费估价`
- 首页描述包含：四川、报废车回收、VIN、免费估价、无需登录、不采集个人信息
- Canonical：`https://baofei.publicrandom.com/`
- Open Graph / Twitter Card：使用 `public/og.png`（1200×630）
- JSON-LD：`WebSite`、`Organization`、`Service`、`FAQPage`
- `robots.txt`：允许收录，只屏蔽 `/api/` 与 `/guanli`
- `sitemap.xml`：只提交首页（全站唯一对外内容页）
- 后台 `/guanli`、`/guanli/tongji`：`noindex, nofollow`

## 线上地址

- 首页：https://baofei.publicrandom.com/
- robots：https://baofei.publicrandom.com/robots.txt
- sitemap：https://baofei.publicrandom.com/sitemap.xml

## 需要人工提交（需要账号权限）

搜索引擎不会因为有了 sitemap 就立刻收录，建议上线后提交一次：

1. **Google Search Console**：添加 `baofei.publicrandom.com` 资源，提交
   `https://baofei.publicrandom.com/sitemap.xml`。
2. **Bing Webmaster Tools**：添加站点并提交同一个 sitemap；Bing 也支持 IndexNow。
3. **百度搜索资源平台**：添加站点，提交 sitemap；国内用户主要靠百度。
4. 提交后观察「覆盖率 / 索引量」，一般几天到两周开始出现。

## 后续内容建议

- 每新增一个可公开访问的内容页，把 URL 加进 `src/app/sitemap.ts`。
- 新页面要有独立的 `title`、`description` 和 canonical，且必须有无案件状态也能读的静态内容。
- 不要给 `/guanli`、`/api` 做外链。
- 外部引流（公众号、朋友圈、二维码）比堆关键词更有效。