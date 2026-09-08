import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "BitHarbor — torrent meta-search",
  description:
    "Torrent meta-search with categories and matching subtitles. No setup, no accounts.",
};

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  // theme set pre-paint to avoid a flash; page.tsx owns the toggle
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
