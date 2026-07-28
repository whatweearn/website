import type { Metadata, Viewport } from "next";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * True in every state.
 *
 * The page copy can promise the dataset opens on submit, because it knows
 * whether anything has published. Metadata cannot: crawlers and social
 * platforms cache it, so a version conditional on today's data would be stale
 * and wrong half the time. This says only what is always so.
 */
const DESCRIPTION =
  "An anonymous salary survey for software engineers in Europe. Nine questions, about two " +
  "minutes. Open data, no accounts, no employer names.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "whatweearn: the anonymous European salary survey",
    template: "%s · whatweearn",
  },
  description: DESCRIPTION,
  applicationName: "whatweearn",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "whatweearn",
    title: "whatweearn: the anonymous European salary survey",
    description: DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "whatweearn: the anonymous European salary survey",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfa" },
    { media: "(prefers-color-scheme: dark)", color: "#131417" },
  ],
};

/**
 * Applies a stored theme choice before first paint.
 *
 * Without this the page renders in the OS theme and then snaps to the stored
 * one on hydration — a visible flash. Kept deliberately tiny and failure-safe:
 * if storage is unavailable, we simply fall through to `prefers-color-scheme`.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("wwe-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="pb-18">{children}</body>
    </html>
  );
}
