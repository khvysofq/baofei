import { site } from "@/lib/site";

// 构建期就固定下来，避免在预渲染时读取当前时间
const copyrightYear = new Date().getFullYear();

const services = [
  {
    title: "服务一",
    body: "用一到两句话说明这项服务解决什么问题、给谁用。内容待填写。",
  },
  {
    title: "服务二",
    body: "用一到两句话说明这项服务解决什么问题、给谁用。内容待填写。",
  },
  {
    title: "服务三",
    body: "用一到两句话说明这项服务解决什么问题、给谁用。内容待填写。",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-neutral-200/70 bg-white/80 backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <a href="/" className="text-lg font-semibold tracking-tight">
            {site.name}
            {site.nameZh ? (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {site.nameZh}
              </span>
            ) : null}
          </a>
          <nav className="hidden items-center gap-8 text-sm text-neutral-600 sm:flex dark:text-neutral-400">
            {site.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-neutral-950 dark:hover:text-neutral-50"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="#contact"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900"
          >
            联系我们
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-neutral-200/70 dark:border-neutral-800/70">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--hero-glow),transparent_70%)]"
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
            <p className="mb-6 inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              {site.name} · 全新站点
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              {site.tagline}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
              这里是网站首屏的补充说明，写清楚你是谁、服务谁、为什么值得信任。两到三行最好，别写成公司简介八股。
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#contact"
                className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900"
              >
                开始对话
              </a>
              <a
                href="#services"
                className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                看看我们做什么
              </a>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            我们能做什么
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            三块内容先占位，等你提供真实业务后替换。
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-neutral-200 p-6 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
              >
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* About */}
        <section
          id="about"
          className="border-y border-neutral-200/70 bg-neutral-50 dark:border-neutral-800/70 dark:bg-neutral-900/40"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              关于 {site.name}
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-neutral-600 sm:text-base dark:text-neutral-400">
              <p>
                第一段：我们是谁、做了多久、最擅长的一件事。写具体的事实，不写形容词。
              </p>
              <p>
                第二段：客户是谁、典型场景是什么、能拿到什么结果。可以放一两个数字。
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="rounded-3xl border border-neutral-200 p-10 sm:p-14 dark:border-neutral-800">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              聊聊你的需求
            </h2>
            <p className="mt-3 max-w-xl text-neutral-600 dark:text-neutral-400">
              留一个最直接的入口：邮箱、电话或表单。别放三个都没人看的渠道。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
              <a
                href={`mailto:${site.contact.email}`}
                className="rounded-full bg-neutral-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900"
              >
                {site.contact.email}
              </a>
              {site.contact.phone ? (
                <span className="text-neutral-600 dark:text-neutral-400">
                  {site.contact.phone}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200/70 dark:border-neutral-800/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {copyrightYear} {site.name}
          </p>
          <p>{site.contact.address || "地址待填写"}</p>
        </div>
      </footer>
    </div>
  );
}