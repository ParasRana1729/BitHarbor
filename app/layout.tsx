import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BitHarbor — torrent meta-search",
  description:
    "Self-hostable torrent meta-search template. Bring your own Jackett/Prowlarr.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  // theme set pre-paint to avoid a flash; page.tsx owns the toggle
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
