import type { Metadata } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com";

export const metadata: Metadata = {
  title: "四川汽车报废怎么办理｜流程、材料与费用一文说清",
  description:
    "用一句话描述车辆情况，自动生成个人办理计划：报废流程分几步、需要哪些材料、拖运与服务费怎么算、预约验车怎么安排。四川地区，无需登录。",
  alternates: { canonical: "/start" },
  openGraph: {
    title: "四川汽车报废怎么办理｜流程、材料与费用",
    description:
      "描述车辆情况，生成个人办理计划：流程、材料、费用与预约安排。四川地区，无需登录。",
    url: `${SITE}/start`,
    siteName: "报废车参考收购价",
    locale: "zh_CN",
    type: "article",
  },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}