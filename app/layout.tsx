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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
