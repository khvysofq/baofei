import Link from "next/link";
import { CITIES } from "@/lib/seo/cities";

/**
 * 全站页脚：备案信息 + 四川各市州内链。
 * 内链是搜索引擎发现落地页的主要途径，所以每个页面都带上。
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-panel/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-bold text-text">四川各市州报废车估价</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-dim">
          {CITIES.map((city) => (
            <li key={city.slug}>
              <Link href={`/${city.slug}`} className="hover:text-brand">
                {city.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            <Link href="/" className="font-bold text-text hover:text-brand">
              报废车参考收购价
            </Link>{" "}
            · 四川地区报废机动车回收信息服务
          </p>
          <p className="text-[11px] leading-relaxed">
            参考区间不构成报价承诺，实际以验车与地磅称重结果为准
          </p>
          <p className="mono text-[10px] tracking-[0.08em]">
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand"
            >
              京ICP备2023038384号
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}