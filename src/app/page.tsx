import type { Metadata } from "next";
import { ValuationApp } from "@/components/valuation/valuation-app";

export const metadata: Metadata = {
  title: "报废残值评估 · 上传行驶证，30 秒看报废值多少",
  description:
    "上传一张行驶证照片，自动识别车型、排量与车龄，按四川地区回收行情拆解废钢、三元催化、有色金属等残值，生成可参考的报废价格评估报告。",
};

export default function Home() {
  return <ValuationApp />;
}