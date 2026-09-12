import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWAScreener — DBC ecosystem",
  description:
    "Track which projects have integrated Meteora DBC, what they built, and what we have verified.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
