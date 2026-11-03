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
  title: "报废车参考收购价",
  description:
    "输入 17 位车辆识别代号（VIN），按回收企业吨价表与整备质量估算报废车参考收购价区间，并列出缺件、拖运与服务费扣减。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com"),
  openGraph: {
    title: "报废车参考收购价",
    description: "输入 VIN，获取四川地区报废车参考收购价区间。",
    type: "website",
    siteName: "报废车参考收购价",
    locale: "zh_CN",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "报废车参考收购价：输入 VIN，获取参考区间",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "报废车参考收购价",
    description: "输入 VIN，按吨价表估算参考收购价区间。",
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