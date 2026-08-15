import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiyat Takip | Trendyol Fiyat Geçmişi",
  description: "Trendyol ürünlerinin fiyat geçmişini takip et, en iyi zamanı yakala.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body>{children}</body>
    </html>
  );
}
