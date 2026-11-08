import Link from "next/link";

/** 内容页通用页头：品牌 + 回首页的估价入口。 */
export function SiteHeader() {
  return (
    <header className="border-b border-line/80 bg-void/90">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-black text-white">
            收
          </span>
          <span className="leading-tight">
            <span className="block text-base font-black tracking-tight">
              报废车参考收购价
            </span>
            <span className="mono block text-[10px] tracking-[0.14em] text-dim">
              VIN QUOTE · SICHUAN
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/wenda" className="hidden text-dim hover:text-brand sm:inline">
            常见问题
          </Link>
          <Link href="/#vin-input" className="btn-primary min-h-[40px] px-4 text-sm">
            免费估价
          </Link>
        </nav>
      </div>
    </header>
  );
}