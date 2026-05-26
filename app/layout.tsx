import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { PlanProvider } from "@/lib/plan-context";
import { GlobalBanners } from "@/components/GlobalBanners";
import SupportChat from "@/components/SupportChat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI LP STUDIO",
  description: "AIがWordPress対応のランディングページHTMLを自動生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <PlanProvider>
            <GlobalBanners />
            {children}
            <SupportChat />
          </PlanProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
