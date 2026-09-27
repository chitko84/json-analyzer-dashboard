import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JSON Analyzer",
  description: "Validate, explore, compare, transform, and generate developer-ready JSON assets entirely in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
