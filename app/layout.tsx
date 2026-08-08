import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WiFi Tuner",
  description: "Chẩn đoán và tối ưu tốc độ WiFi cho Windows",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-display antialiased">{children}</body>
    </html>
  );
}
