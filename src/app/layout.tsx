import type { Metadata, Viewport } from "next";
import { Inter, Urbanist } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

/**
 * Two voices with non-overlapping jobs (CLAUDE.md D51).
 *
 * Urbanist sets every heading — large, light and tightly tracked, the
 * editorial voice of the marketing site and of page titles in the app.
 *
 * Inter carries interface text and every numeral: it stays legible at 12px
 * in a dense table, and its tabular figures keep a metric column aligned,
 * which Urbanist's proportional digits would not.
 */
const display = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SENSO — Influencer Intelligence",
    template: "%s · SENSO",
  },
  description:
    "Evidence-based influencer intelligence: verified creator profiles, deterministic scoring, audience quality signals and campaign performance measurement.",
  applicationName: "SENSO",
  metadataBase: new URL("https://senso360.com"),
  // The marketing site is indexable; every signed-in route group sets
  // `robots: noindex` in its own layout.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Duplicates --color-canvas in globals.css by value — Next metadata cannot
  // read a CSS custom property. Change both together.
  themeColor: "#f6f6f5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
