import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * This is the site's "no third-party scripts" promise turned into something a
 * browser enforces. Cloudflare Turnstile is the only external origin allowed
 * anywhere; if anyone later adds an analytics snippet, a font CDN or a chat
 * widget, it gets blocked rather than quietly shipped.
 *
 * `'unsafe-inline'` on script-src is a real weakening and worth being honest
 * about. Next.js emits inline hydration scripts, and the alternative — a
 * per-request nonce — forces every page to render dynamically, costing the
 * static delivery of pages that never change. The trade is acceptable *here
 * specifically* because there is no user-generated content anywhere on this
 * site to inject through: every survey answer is a bounded choice, so the
 * usual reflected and stored XSS surface does not exist. On a site with a
 * comment box this would be the wrong call.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Two years, preloadable. A salary should never cross the wire in plaintext,
  // including on a first visit typed without a scheme.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Origin at most, never the path. Nobody downstream needs to learn that a
  // visitor arrived from the survey.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Nothing gained by advertising the framework version.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
