import { beforeEach, describe, expect, it } from "vitest";

import { FORM_TOKEN_LIMITS, issueFormToken, verifyFormToken } from "./formToken";
import { clientAddress, dayStamp, sameDayHandle } from "./identity";
import { RATE_LIMIT, checkRateLimit, resetRateLimits } from "./rateLimit";

const { MIN_FILL_MS, MAX_FILL_MS } = FORM_TOKEN_LIMITS;

describe("form token", () => {
  const issuedAt = 1_800_000_000_000;

  it("accepts a token filled in at a human pace", () => {
    const token = issueFormToken(issuedAt);
    expect(verifyFormToken(token, issuedAt + 60_000)).toEqual({ ok: true, issuedAt });
  });

  it("rejects a submission faster than a person can answer nine screens", () => {
    const token = issueFormToken(issuedAt);
    const result = verifyFormToken(token, issuedAt + MIN_FILL_MS - 1);
    expect(result).toEqual({ ok: false, reason: "too_fast" });
  });

  it("rejects a stale form rather than accepting a day-old token", () => {
    const token = issueFormToken(issuedAt);
    const result = verifyFormToken(token, issuedAt + MAX_FILL_MS + 1);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a forged issue time", () => {
    // The whole point: a client that rewrites the timestamp to look slower
    // cannot produce a matching signature.
    const token = issueFormToken(issuedAt);
    const [, signature] = token.split(".");
    const forged = `${issuedAt - MIN_FILL_MS * 2}.${signature}`;
    expect(verifyFormToken(forged, issuedAt + 1_000)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a tampered signature", () => {
    const token = issueFormToken(issuedAt);
    expect(verifyFormToken(`${token}x`, issuedAt + 60_000)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", "nonsense", "a.b.c", "notanumber.sig"]) {
      expect(verifyFormToken(bad, issuedAt).ok).toBe(false);
    }
  });

  it("carries no identity: same instant, same token", () => {
    expect(issueFormToken(issuedAt)).toBe(issueFormToken(issuedAt));
  });
});

describe("same-day handle", () => {
  const monday = new Date("2026-03-02T10:00:00Z");
  const tuesday = new Date("2026-03-03T10:00:00Z");

  it("is stable within a day", () => {
    expect(sameDayHandle("1.2.3.4", "Firefox", monday)).toBe(
      sameDayHandle("1.2.3.4", "Firefox", monday),
    );
  });

  it("changes the next day, so it cannot follow anyone over time", () => {
    expect(sameDayHandle("1.2.3.4", "Firefox", monday)).not.toBe(
      sameDayHandle("1.2.3.4", "Firefox", tuesday),
    );
  });

  it("separates different visitors", () => {
    expect(sameDayHandle("1.2.3.4", "Firefox", monday)).not.toBe(
      sameDayHandle("5.6.7.8", "Firefox", monday),
    );
  });

  it("does not leak the address it was derived from", () => {
    const handle = sameDayHandle("203.0.113.42", "Safari", monday);
    expect(handle).not.toContain("203");
    expect(handle).not.toContain("113");
    expect(handle).not.toContain("42");
  });

  it("still changes when only the day changes at a boundary", () => {
    expect(dayStamp(new Date("2026-03-02T23:59:59Z"))).toBe("2026-03-02");
    expect(dayStamp(new Date("2026-03-03T00:00:01Z"))).toBe("2026-03-03");
  });
});

describe("clientAddress", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.1, 70.41.3.18" });
    expect(clientAddress(headers)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});

describe("rate limit", () => {
  beforeEach(resetRateLimits);

  it("allows up to the limit then refuses", () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT.MAX_PER_WINDOW; i++) {
      expect(checkRateLimit("handle", now).allowed).toBe(true);
    }
    expect(checkRateLimit("handle", now).allowed).toBe(false);
  });

  it("counts each handle separately", () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT.MAX_PER_WINDOW; i++) checkRateLimit("a", now);
    expect(checkRateLimit("a", now).allowed).toBe(false);
    expect(checkRateLimit("b", now).allowed).toBe(true);
  });

  it("opens a fresh window once the old one expires", () => {
    const now = Date.now();
    for (let i = 0; i <= RATE_LIMIT.MAX_PER_WINDOW; i++) checkRateLimit("handle", now);
    expect(checkRateLimit("handle", now).allowed).toBe(false);
    expect(checkRateLimit("handle", now + RATE_LIMIT.WINDOW_MS + 1).allowed).toBe(true);
  });
});
