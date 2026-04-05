import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "N'oubliez pas les paroles — Duel",
  description:
    "Jeu multijoueur : complétez les paroles de chansons françaises en duel !",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0a2e] text-white font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}
