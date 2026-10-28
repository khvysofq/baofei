import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "四川汽车报废办理助手",
  description:
    "在四川线上办理车辆报废：一句话说清情况，核对材料，比较回收方报价，预约交车，跟踪注销与结算进度。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://112.119.223.47:10802"),
  openGraph: {
    title: "四川汽车报废办理助手",
    description: "一句话说清情况，核对材料，比较回收方报价，预约交车，跟踪注销与结算进度。",
    type: "website",
    siteName: "报废助手",
    locale: "zh_CN",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "报废助手：报废一辆车，最怕的是不知道下一步",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "四川汽车报废办理助手",
    description: "用一段日常描述开始，理清办理计划、材料、报价与四条办理状态。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}