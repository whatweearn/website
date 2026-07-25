import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isEmailConfigured } from "./resend";

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
