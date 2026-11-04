import type { Metadata } from "next";
import { VisitTracker } from "@/components/analytics/visit-tracker";
import { ValuationApp } from "@/components/valuation/valuation-app";

export const metadata: Metadata = {
  title: "报废车参考收购价 · 输入 VIN 获取价格区间",
  description:
    "输入 17 位车辆识别代号（VIN），按回收企业吨价表与整备质量估算报废车参考收购价区间，并列出缺件、拖运与服务费扣减。仅 VIN 估算，未验车，不构成实际报价。",
};

export default function Home() {
  return (
    <>
      <VisitTracker />
      <ValuationApp />
    </>
  );
}