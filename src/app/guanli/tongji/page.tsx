import { redirect } from "next/navigation";
import { StatsApp } from "@/components/admin/stats-app";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export const instant = false;

export const metadata = {
  title: "数据统计 · 报废车参考收购价",
  robots: { index: false, follow: false },
};

export default async function AdminStatsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/guanli");
  }
  return <StatsApp />;
}