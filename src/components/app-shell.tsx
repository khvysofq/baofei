"use client";

/**
 * 全站外壳：只保留无障碍跳转与背景纹理。
 * 旧的案件办理流程（/start /plan /documents /quotes /appointment /case /subsidy）
 * 已下线，产品收敛为「输入 VIN 估价」，不再有案件上下文、侧边导航与调试抽屉。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-10 focus:z-[70] focus:bg-acid focus:px-3 focus:py-2 focus:text-void"
      >
        跳到主要内容
      </a>
      {children}
      <div className="noise-overlay" aria-hidden />
    </div>
  );
}