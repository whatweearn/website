import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Confirmation and unsubscribe links.
 *
 * Derived from the address rather than stored, so there is no token column to
 * leak and no lookup table tying a random string to a person. The same address
 * always produces the same link, which also makes unsubscribing work from an
 * email received a year ago.
 */

export type Purpose = "confirm" | "unsubscribe";

function secret(): string {
  const value = process.env.SUBSCRIBER_TOKEN_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUBSCRIBER_TOKEN_SECRET must be set in production");
  }
  return "dev-insecure-subscriber-token-secret";
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function tokenFor(email: string, purpose: Purpose): string {
  return createHmac("sha256", `${secret()}:${purpose}`)
    .update(normaliseEmail(email))
    .digest("base64url");
}

export function verifyToken(email: string, purpose: Purpose, token: string): boolean {
  const expected = Buffer.from(tokenFor(email, purpose));
  const given = Buffer.from(token);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/**
 * A very forgiving address check.
 *
 * Deliberately not a strict RFC 5322 parser: rejecting a valid-but-unusual
 * address is a worse outcome than accepting one that later bounces, and the
 * double opt-in confirms deliverability anyway.
 */
export function looksLikeEmail(value: string): boolean {
  const email = normaliseEmail(value);
  return email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email);
}
