import type { Metadata, Viewport } from "next";
import { Onest, Outfit } from "next/font/google";
import "./globals.css";

// Ultraviolet's faces. next/font downloads them at build time and serves them from this site, so phones fetch nothing from Google.
const outfit = Outfit({ subsets: ["latin"], weight: ["300", "500"], display: "swap", variable: "--font-outfit" });
const onest = Onest({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-onest" });

export const metadata: Metadata = {
  title: "Custom Order Manager",
  description: "Custom order tracking",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f9fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${onest.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
