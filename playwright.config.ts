import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The survey is answered on phones as often as laptops, and the wizard's
    // layout differs there, so it is not an optional extra.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Blanked so the suite can never reach a real database.
      //
      // `next start` loads `.env.local`, and on a developer's machine that
      // holds the *production* credentials. Without these four lines the funnel
      // tests submit their fixture — Germany, senior, 78000 — straight into the
      // live responses table, which is exactly what happened on 2026-07-26:
      // two rows, one per project user-agent, the same-day dedup handle having
      // collapsed the repeat runs. They then reached the published figures on
      // the next aggregation, so the site reported responses that no person had
      // given. On a site whose whole claim is that its numbers are checkable,
      // that is the worst possible kind of bug.
      //
      // Empty means `hasDatabase()` is false and `getRepository()` returns the
      // in-memory implementation, which is what CI has always done — CI sets no
      // database secrets for this workflow. The suite now behaves identically
      // in both places, and it was the divergence that hid this.
      DATABASE_URL: "",
      DATABASE_URL_DIRECT: "",
      SUBSCRIBER_DATABASE_URL: "",
      SUBSCRIBER_DATABASE_URL_DIRECT: "",
      // `next start` runs as production, where the app refuses to fall back to
      // development secrets — correctly. These are throwaway values that exist
      // only so the suite can boot; they are not secrets and never leave here.
      FORM_TOKEN_SECRET: "e2e-form-token-secret-not-used-anywhere-real",
      IDENTITY_SECRET: "e2e-identity-secret-not-used-anywhere-real",
      // Cloudflare's documented always-pass test keys. This exercises the
      // real verification path rather than adding a bypass flag to production
      // code — a bypass is exactly the kind of thing that survives into a
      // deployment and silently disables the defence.
      // The 20s floor exists to stop bots; an automated run legitimately
      // finishes in seconds. Lowered here, never disabled.
      FORM_MIN_FILL_MS: "0",
      // The real controller identity: the legal pages assert against it, and
      // the "not ready to collect data" alert must be gone.
      LEGAL_CONTROLLER_NAME: "Codeetry SRL",
      LEGAL_CONTACT_EMAIL: "privacy@whatweearn.eu",
      LEGAL_CONTROLLER_ADDRESS: "Mont-Saint-Guibert, Belgium",
      LEGAL_COMPANY_NUMBER: "0880.250.749",
      LEGAL_VAT_ID: "BE0880250749",
      LEGAL_JURISDICTION: "BE",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
  },
});
