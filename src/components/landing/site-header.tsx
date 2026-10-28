import Link from "next/link";

const NAV = [
  { href: "#problems", label: "痛点", mono: "01" },
  { href: "#how", label: "流程", mono: "02" },
  { href: "#money", label: "费用", mono: "03" },
  { href: "#scope", label: "边界", mono: "04" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-8 z-30 border-b border-line bg-void/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-0 items-center gap-3"
          aria-label="报废助手首页"
        >
          <span className="text-xl font-black tracking-tight">报废助手</span>
          <span className="mono hidden text-[10px] uppercase tracking-[0.18em] text-dim sm:inline">
            四川 · SCRAP ASSIST
          </span>
        </Link>

        <nav aria-label="页面分区" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="mono flex min-h-[44px] items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-dim transition-colors hover:text-text"
            >
              <span className="text-line-strong">{item.mono}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <Link href="/start" className="btn-primary text-sm">
          进入演示
        </Link>
      </div>
    </header>
  );
}