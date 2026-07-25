import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { isEmailConfigured, sendEmail } from "./resend";

afterEach(() => vi.unstubAllEnvs());

const source = readFileSync(join(process.cwd(), "src/lib/email/resend.ts"), "utf8");

describe("Resend is a transport, not a database", () => {
  it("never calls the Audiences or Contacts endpoints", () => {
    // Easy to violate the first time somebody wants a quick contact list, and
    // it would mean the subscriber list existing in two places: one deletion
    // path becomes two, and one of them eventually gets forgotten.
    for (const endpoint of ["/audiences", "/contacts", "audiences.create", "contacts.create"]) {
      expect(source).not.toContain(endpoint);
    }
  });

  it("posts only to the send endpoint", () => {
    const urls = [...source.matchAll(/https:\/\/api\.resend\.com[^\s"'`]*/g)].map((m) => m[0]);
    expect(urls).toEqual(["https://api.resend.com/emails"]);
  });

  it("attaches one-click unsubscribe headers when given a link", () => {
    // RFC 8058. This list lies idle for months, which is exactly when people
    // reach for "mark as spam" rather than hunting for a link.
    expect(source).toContain("List-Unsubscribe");
    expect(source).toContain("List-Unsubscribe-Post");
  });
});

describe("configuration", () => {
  it("reports unconfigured when credentials are absent", () => {
    expect(isEmailConfigured()).toBe(false);
  });
});

describe("links must be usable from an inbox", () => {
  it("refuses in production to send a message containing a localhost link", async () => {
    // Found in a real delivered email: NEXT_PUBLIC_SITE_URL was unset, so every
    // confirmation link pointed at localhost. The send succeeded, the message
    // looked correct, and the link was dead for the recipient.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("EMAIL_FROM", "a@b.co");

    const result = await sendEmail({
      to: "someone@example.org",
      subject: "x",
      text: "Confirm: http://localhost:3000/api/subscribe/confirm?token=1",
    });

    expect(result).toEqual({ ok: false, reason: "link_points_at_localhost" });
  });
});
