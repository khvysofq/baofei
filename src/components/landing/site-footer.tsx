import { PolicyDisclosure } from "./policy-disclosure";

export function SiteFooter() {
  return (
    <footer className="bg-void">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 border-b border-line pb-10 text-center md:grid-cols-3 md:items-start md:text-left">
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-dim">
            V1.1 · 四川地区
          </p>
          <PolicyDisclosure />
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-dim md:text-right">
            四川地区 · 成都
          </p>
        </div>

        <p className="mono mt-6 text-[11px] leading-relaxed tracking-[0.04em] text-dim">
          © 2026 报废助手
        </p>
      </div>
    </footer>
  );
}