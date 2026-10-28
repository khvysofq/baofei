import Link from "next/link";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/95 backdrop-blur-sm">
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

        <NavLinks />

        <Link href="/start" className="btn-primary text-sm">
          立即办理
        </Link>
      </div>
    </header>
  );
}