/**
 * 全站只有一个地方改文案：这里。
 * 改完保存，dev server 会自动刷新。
 */
export const site = {
  name: "baofei",
  // 中文名 / 品牌名，有就填，没有先留空
  nameZh: "",
  // 一句话定位：首页大字下面的那行
  tagline: "一句话说清这个网站是做什么的",
  description: "baofei 官方网站",
  locale: "zh-CN",
  nav: [
    { label: "首页", href: "/" },
    { label: "关于", href: "/#about" },
    { label: "服务", href: "/#services" },
    { label: "联系", href: "/#contact" },
  ],
  contact: {
    email: "hello@example.com",
    phone: "",
    address: "",
  },
} as const;