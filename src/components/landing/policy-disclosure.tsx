"use client";

import { useState } from "react";

const SOURCES = [
  {
    id: "S1",
    title: "报废机动车回收管理办法",
    org: "国家市场监督管理总局",
    href: "https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_b77eb0f24b084d0983ccba6a5b714d3c.html",
  },
  {
    id: "S2",
    title: "机动车登记规定（公安部令第164号）",
    org: "全国规则",
    href: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202206/t20220607_2731463.html",
  },
  {
    id: "S3",
    title: "报废机动车回收管理办法实施细则",
    org: "商务部",
    href: "https://www.mofcom.gov.cn/zcfb/zhzc/art/2020/art_4b577292ebbd47ed951c5a9de21454b7.html",
  },
  {
    id: "S4",
    title: "2026年汽车以旧换新补贴实施细则",
    org: "商务部",
    href: "https://www.mofcom.gov.cn/zcfg/art/2025/art_c5ba34448a2a4eea83b1d0b89b699807.html",
  },
  {
    id: "S5",
    title: "四川省2026年汽车以旧换新补贴实施细则",
    org: "四川省商务厅等 8 部门",
    href: "https://www.nanchong.gov.cn/sswj/zwxx/zcwj/xzgfxwj/202603/t20260324_2321144.html",
  },
  {
    id: "S6",
    title: "四川省报废机动车回收管理实施办法（试行）",
    org: "四川省商务厅等 7 部门",
    href: "https://swj.cngy.gov.cn/gongkai/show/32cc8cbcff2b4729a4079bd09fb8932f.html",
  },
  {
    id: "S7",
    title: "全国汽车流通信息管理系统",
    org: "商务部",
    href: "https://qclt.mofcom.gov.cn/",
  },
  {
    id: "S8",
    title: "新能源汽车废旧动力电池回收和综合利用管理暂行办法",
    org: "工信部",
    href: "https://www.miit.gov.cn/gyhxxhb/jgsj/cyzcyfgs/bmgz/jdcjxl/art/2026/art_392462fdc40c415ea4a4129cac3028c2.html",
  },
  {
    id: "S9",
    title: "新能源汽车动力电池管理办法新闻发布会",
    org: "工信部",
    href: "https://wap.miit.gov.cn/xwfb/xwfbh/bxwfbh/art/2026/art_c5c9031e409e468eb4004d82fd394241.html",
  },
];

export function PolicyDisclosure() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="policy-sources"
        className="mx-auto flex min-h-[44px] items-center gap-2 text-sm text-dim transition-colors hover:text-text"
      >
        <span>政策依据</span>
        <span className="mono text-rust" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      <div id="policy-sources" hidden={!open} className="mt-4">
        <ol className="mx-auto max-w-xl space-y-3 text-left">
          {SOURCES.map((source) => (
            <li key={source.id} className="flex gap-3 text-sm leading-relaxed">
              <span className="mono shrink-0 text-rust">{source.id}</span>
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer noopener"
                className="link-rust break-words"
              >
                {source.title}
                <span className="ml-2 text-xs text-dim">{source.org}</span>
              </a>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-4 max-w-xl text-xs leading-relaxed text-dim">
          链接为官方或官方转发页面，仅作资料导航；打开链接不改变办理状态，也不代表资质已核验。
        </p>
      </div>
    </div>
  );
}