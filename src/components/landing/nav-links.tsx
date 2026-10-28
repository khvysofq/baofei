"use client";

import { useEffect, useState } from "react";

const NAV = [
  { href: "#problems", label: "痛点", mono: "01" },
  { href: "#how", label: "流程", mono: "02" },
  { href: "#money", label: "费用", mono: "03" },
  { href: "#scope", label: "边界", mono: "04" },
];

export function NavLinks() {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const sections = NAV.map((item) => document.querySelector(item.href)).filter(
      (el): el is Element => Boolean(el),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-32% 0px -58% 0px", threshold: [0, 0.2, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="页面分区" className="hidden items-center gap-6 md:flex">
      {NAV.map((item) => {
        const isActive = active === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={isActive ? "true" : undefined}
            className={`mono relative flex min-h-[44px] items-center gap-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
              isActive ? "text-text" : "text-dim hover:text-text"
            }`}
          >
            <span className={isActive ? "text-rust" : "text-line-strong"}>
              {item.mono}
            </span>
            {item.label}
            <span
              aria-hidden
              className={`absolute inset-x-0 bottom-1 h-px origin-left bg-rust transition-transform duration-300 ${
                isActive ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}