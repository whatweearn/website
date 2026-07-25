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
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
  },
});
