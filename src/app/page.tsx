import type { Metadata } from "next";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MoneySection } from "@/components/landing/money";
import { Problems } from "@/components/landing/problems";
import { ScopeSection } from "@/components/landing/scope";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  title: "报废助手 · 四川汽车报废办理演示",
  description:
    "用一段日常描述开始：整理办理计划、要准备的材料、两家演示报价，以及每个阶段该看哪张凭证。全程演示模式。",
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Problems />
        <HowItWorks />
        <MoneySection />
        <ScopeSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}