import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenScore",
  description: "Open-source, ad-free sports scores and data query product",
  applicationName: "OpenScore",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

