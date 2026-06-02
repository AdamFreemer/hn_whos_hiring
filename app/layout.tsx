import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

// Canonical site URL for absolute OG/Twitter image links (used by iMessage,
// Slack, etc.). Tracks the Vercel production domain so the preview image
// resolves to THIS deployment; falls back to the known prod URL locally.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://hn-whos-hiring.vercel.app";

export const metadata: Metadata = {
  title: "The Hiring Thread, Counted — Ask HN: Who is hiring?",
  description:
    "A live read of the Hacker News whoishiring account: every monthly thread, and which languages and frameworks show up in any given one. Post-level counts, with a configurable trend over time.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "The Hiring Thread, Counted",
    description:
      "Which languages and frameworks show up in the monthly HN “Who is hiring?” threads — counted at the post level, with trends over time.",
    type: "website",
    url: SITE_URL,
    siteName: "The Hiring Thread, Counted",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Hiring Thread, Counted",
    description:
      "Which languages and frameworks show up in the monthly HN “Who is hiring?” threads.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
