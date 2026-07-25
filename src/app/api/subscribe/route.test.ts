import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("https://whatweearn.test/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/subscribe", () => {
  it("rejects something that is not an address", async () => {
    const res = await post({ email: "nope" });
    expect(res.status).toBe(400);
  });

  it("reports honestly when the list is unavailable", async () => {
    // No SUBSCRIBER_DATABASE_URL in the test environment.
    const res = await post({ email: "someone@example.org" });
    expect(res.status).toBe(503);
  });

  it("never claims success when no confirmation email was sent", async () => {
    // The failure this guards: "check your inbox" for a message that was never
    // sent. The person waits, nothing arrives, and the address expires
    // unconfirmed — a silent loss at the one moment they opted in.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/subscribe/route.ts", "utf8"),
    );
    expect(source).toMatch(/if \(!sent\.ok\)/);
    expect(source).toContain("502");
  });
});
