/**
 * 全站只有一个地方改文案：这里。
 * 改完保存，dev server 会自动刷新。
 */
export const site = {
  name: "报废残值评估",
  // 中文名 / 品牌名，有就填，没有先留空
  nameZh: "报废残值评估",
  // 一句话定位：首页大字下面的那行
  tagline: "上传行驶证，看清这辆车报废值多少",
  description: "四川地区报废机动车残值评估",
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