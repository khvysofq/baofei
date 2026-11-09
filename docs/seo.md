# SEO 配置与提交

## 已实现的页面级 SEO

- 首页标题：`四川报废车回收价格查询｜输入 VIN 免费估价`
- 首页描述包含：四川、报废车回收、VIN、免费估价、无需登录、不采集个人信息
- Canonical：`https://baofei.publicrandom.com/`
- Open Graph / Twitter Card：使用 `public/og.png`（1200×630）
- JSON-LD：`WebSite`、`Organization`、`Service`、`FAQPage`
- `robots.txt`：允许收录，只屏蔽 `/api/` 与 `/guanli`
- `sitemap.xml`：首页 + 21 个市州落地页，共 22 条
- 后台 `/guanli`、`/guanli/tongji`：`noindex, nofollow`

## 城市落地页（`/[city]`）

- 数据源：`src/lib/seo/cities.ts`（21 个市州，含号牌代码、片区、本地要点）。加城市只改这一个文件，
  路由、sitemap、页脚内链会自动带上。
- 每个页面有独立的 `title` / `description` / canonical / OG，以及 BreadcrumbList + Service + FAQPage 结构化数据。
- 页面上的 VIN 输入只做格式校验，然后把 VIN 带到首页估价框（`/?vin=...#vin-input`），
  不在 21 个页面重复渲染整份估价应用，避免页面互相抢同一批关键词。
- 未知 slug 走 `notFound()` 返回 404，不会产生软 404。
- 内容口径：只写可核实的事实（号牌代码、所属片区、注销受理机关的一般规则），
  不写具体车管所地址、补贴金额和日期，避免过期。

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
## 抓取现状与冷启动（2026-11-09 实测）

nginx 日志（10/28–11/10）里 **只有 GPTBot 来过一次**，Baiduspider / Googlebot / bingbot
一次都没有；`/robots.txt` 和 `/sitemap.xml` 也只有一个外部 IP 请求过。结论：

- 不是被墙、也不是 UA 拦截（用 Baiduspider / Googlebot / bingbot 的 UA 请求，首页和 sitemap 都是 200）。
- 是**没人知道这个域名存在**：零外链、百度 API 配额为 0，蜘蛛没有任何发现路径。

破局顺序：

1. **百度资源平台 → 普通收录 → sitemap 提交**（不占推送配额），然后看「索引量」而不是只看配额。
2. **IndexNow**（Bing / Yandex / Seznam，免费无配额）：`./scripts/indexnow-push.sh`。
   key 文件在 `public/<key>.txt`，必须能从根路径直接访问。已推送一次，返回 HTTP 202。
3. **外链**：这是百度最认的信号。公众号文章、知乎回答、小红书、地方论坛、企业黄页、
   合作修理厂的门店页，都可以放一条链接。纯靠 sitemap 等百度主动来，新站可能要几周。
4. Google 需要 Search Console 手动提交 sitemap（Google 已停用 sitemap ping 接口）。

排查命令（在云端执行）：

```bash
zcat -f /var/log/nginx/access.log* | grep -F "baofei.publicrandom.com" > /tmp/bf.log
grep -icE "baiduspider|googlebot|bingbot" /tmp/bf.log
```
