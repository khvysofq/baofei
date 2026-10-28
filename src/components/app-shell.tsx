"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaseProvider, useCase } from "@/components/case-provider";
import { DemoDrawer } from "@/components/demo-drawer";

const NAV = [
  { href: "/start", label: "首页", mono: "HOME" },
  { href: "/case", label: "我的办理", mono: "CASE" },
  { href: "/case#help", label: "帮助", mono: "HELP" },
];

function regionText(snapshot: ReturnType<typeof useCase>["snapshot"]): string {
  const field = snapshot?.fields.find((f) => f.field === "vehicleLocation");
  const value = field?.value as { province?: string | null; city?: string | null } | null;
  if (!value?.province) return "地区待确认";
  if (!value.city) return `${value.province}·市州待确认`;
  return value.province === value.city ? value.city : `${value.province}·${value.city}`;
}

function DemoStrip() {
  const { snapshot } = useCase();
  return (
    <div className="sticky top-0 z-40 border-b border-line-strong bg-void/95 scanlines">
      <div className="mx-auto flex h-8 max-w-[1320px] items-center justify-between gap-3 px-3">
        <p className="mono truncate text-[10px] tracking-[0.14em] text-warn">
          DEMO · 演示模式 · 演示数据不产生真实法律效力
        </p>
        <p className="mono shrink-0 text-[10px] tracking-[0.08em] text-dim">
          {snapshot?.case.caseNo ?? "NO CASE"}
        </p>
      </div>
    </div>
  );
}

function SideNav() {
  const pathname = usePathname();
  const { snapshot, loading } = useCase();
  return (
    <aside className="sticky top-8 hidden h-[calc(100dvh-2rem)] w-[220px] shrink-0 border-r border-line px-4 py-6 lg:block">
      <Link href="/start" className="block">
        <p className="label text-rust">SICHUAN · SCRAP ASSIST</p>
        <p className="mt-1 text-2xl font-black tracking-tight">报废助手</p>
        <p className="mono mt-1 text-[11px] text-dim">DEMO-SC-V1.1</p>
      </Link>

      <nav aria-label="主要导航" className="mt-8 space-y-1">
        {NAV.map((item) => {
          const active =
            !item.href.includes("#") && pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center justify-between border-l-2 px-3 text-sm transition-colors ${
                active
                  ? "border-brand bg-panel text-text"
                  : "border-transparent text-dim hover:border-line-strong hover:text-text"
              }`}
            >
              <span className="font-semibold">{item.label}</span>
              <span className="mono text-[10px] tracking-[0.18em] text-dim">
                {item.mono}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-line pt-4">
        <p className="label">当前地区</p>
        <p className="mt-1 text-sm font-semibold">
          {loading && !snapshot ? "加载中…" : `${regionText(snapshot)}（演示）`}
        </p>
        <p className="mono mt-2 text-[11px] text-dim">
          {snapshot?.policy.statusLabel ?? "未选择案件"}
        </p>
      </div>

      <div className="mt-6 space-y-2 text-xs text-dim">
        <p className="flex items-center gap-2">
          <span className="lamp text-acid breathe" aria-hidden />
          演示环境在线
        </p>
        <p>不接真实政务、企业或支付接口。</p>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const { snapshot } = useCase();
  return (
    <header className="sticky top-8 z-30 border-b border-line bg-void/95 px-3 py-2 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/start" className="flex items-baseline gap-2">
          <span className="text-lg font-black tracking-tight">报废助手</span>
          <span className="mono text-[10px] text-dim">四川 · DEMO</span>
        </Link>
        <span className="tag text-dim">{regionText(snapshot)}</span>
      </div>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="底部导航"
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-t border-line-strong bg-void/95 lg:hidden"
    >
      {NAV.map((item) => {
        const active = item.href === "/case" ? pathname === "/case" : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-xs ${
              active ? "text-rust" : "text-dim"
            }`}
          >
            <span className="mono text-[10px] tracking-[0.16em]">{item.mono}</span>
            <span className="font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ShellBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-10 focus:z-[70] focus:bg-acid focus:px-3 focus:py-2 focus:text-void"
      >
        跳到主要内容
      </a>
      <DemoStrip />
      <div className="mx-auto flex w-full max-w-[1320px]">
        <SideNav />
        <div className="min-w-0 flex-1">
          <MobileHeader />
          <main id="main" className="px-3 pb-28 pt-4 sm:px-5 lg:px-8 lg:pb-16 lg:pt-8">
            {children}
          </main>
        </div>
      </div>
      <MobileNav />
      <DemoDrawer />
      <div className="noise-overlay" aria-hidden />
    </div>
  );
}

function LandingStrip() {
  return (
    <div className="sticky top-0 z-40 border-b border-line-strong bg-void/95 scanlines">
      <div className="mx-auto flex h-8 max-w-[1440px] items-center px-4 sm:px-6">
        <p className="mono truncate text-[10px] tracking-[0.14em] text-warn">
          DEMO · 演示模式 · 演示数据不产生真实法律效力
        </p>
      </div>
    </div>
  );
}

function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-10 focus:z-[70] focus:bg-acid focus:px-3 focus:py-2 focus:text-void"
      >
        跳到主要内容
      </a>
      <LandingStrip />
      {children}
      <div className="noise-overlay" aria-hidden />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 首页是静态营销页：不接入案件上下文、演示控制抽屉与侧边导航。
  if (pathname === "/") return <LandingShell>{children}</LandingShell>;
  return (
    <CaseProvider>
      <ShellBody>{children}</ShellBody>
    </CaseProvider>
  );
}