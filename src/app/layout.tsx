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
  title: "报废残值评估",
  description:
    "输入车辆识别代号（VIN）或上传行驶证照片，按四川地区回收行情拆解废钢、三元催化、有色金属等残值，生成报废价格评估报告。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://baofei.publicrandom.com"),
  openGraph: {
    title: "报废残值评估",
    description: "输入 VIN 或上传行驶证，30 秒看清这辆车报废值多少。",
    type: "website",
    siteName: "报废残值评估",
    locale: "zh_CN",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "报废残值评估：输入 VIN，看清报废值多少",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "报废残值评估",
    description: "输入 VIN 或上传行驶证，自动拆解残值并生成评估报告。",
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