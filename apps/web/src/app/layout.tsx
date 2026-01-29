import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Providers } from "./providers";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsfiled.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WhatsFiled - Insider Trading Made Clear",
    template: "%s | WhatsFiled",
  },
  description:
    "Track SEC Form 4 insider trading filings. Search public companies, follow insiders, and monitor stock transactions in real-time.",
  keywords: [
    "SEC filings",
    "Form 4",
    "insider trading",
    "stock transactions",
    "SEC EDGAR",
    "insider buying",
    "insider selling",
    "executive stock sales",
  ],
  authors: [{ name: "WhatsFiled" }],
  creator: "WhatsFiled",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "WhatsFiled",
    title: "WhatsFiled - Insider Trading Made Clear",
    description:
      "Track SEC Form 4 insider trading filings. Search public companies, follow insiders, and monitor stock transactions in real-time.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsFiled - Insider Trading Made Clear",
    description:
      "Track SEC Form 4 insider trading filings. Search public companies, follow insiders, and monitor stock transactions in real-time.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          <ChatWidget />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
