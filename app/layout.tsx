import type { Metadata } from "next";
import { MotionRoot } from "./components/motion-root";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWAScreener — DBC ecosystem",
  description: "Meteora DBC launchpads.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
