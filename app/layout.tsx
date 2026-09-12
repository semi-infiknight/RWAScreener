import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWAScreener — DBC ecosystem",
  description:
    "Explore launchpads and builders integrating Meteora DBC. Listings describe what we know — not endorsements.",
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
