import { PolicyDisclosure } from "./policy-disclosure";

export function SiteFooter() {
  return (
    <footer className="bg-void">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 border-b border-line pb-10 text-center md:grid-cols-3 md:items-start md:text-left">
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-dim">
            DEMO-SC-V1.1 · 演示环境
          </p>
          <PolicyDisclosure />
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-dim md:text-right">
            四川 · 成都 示例场景
          </p>
        </div>

        <p className="mono mt-6 text-[11px] leading-relaxed tracking-[0.04em] text-dim">
          本页为产品演示，企业、报价、时段与凭证均为虚构；补贴与政策条款以官方发布为准。
        </p>
      </div>
    </footer>
  );
}