import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWAScreener — DBC ecosystem",
  description:
    "Meteora DBC launchpads.",
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
