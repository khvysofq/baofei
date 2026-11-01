import type { Metadata } from "next";
import { ValuationApp } from "@/components/valuation/valuation-app";

export const metadata: Metadata = {
  title: "报废残值评估 · 输入 VIN，30 秒看报废值多少",
  description:
    "填写车辆识别代号（VIN）或上传行驶证照片，自动解析车型与车龄，按四川地区回收行情拆解废钢、三元催化、有色金属等残值，生成可参考的报废价格评估报告。",
};

export default function Home() {
  return <ValuationApp />;
}