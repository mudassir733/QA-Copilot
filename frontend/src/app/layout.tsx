import type { Metadata } from "next";
import { AppShell } from "@/app/components/AppShell";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QA Copilot",
  description:
    "Upload documents, ask grounded questions, and inspect cited sources in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetBrainsMono.variable} h-full`}>
      <body className={`${inter.className} h-full overflow-hidden`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
