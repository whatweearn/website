import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed proof that we served this form, and when.
 *
 * The obvious alternative — having the client post the time it started — is
 * theatre: a bot sets whatever number it likes. Signing the issue time server
 * side means the minimum-duration check actually holds.
 *
 * The token carries no identity. It is issued per page render, not per person,
 * and two visitors loading the form in the same millisecond get identical
 * tokens. That is deliberate: it must not become a tracking handle.
 */

/**
 * A human cannot answer nine screens faster than this.
 *
 * Configurable because automated end-to-end runs legitimately complete in
 * seconds — and lowering it there is far better than adding a bypass flag that
 * could disable the check entirely in production. It is a tuning parameter,
 * not an on/off switch: whatever it is set to, the signature check still runs.
 */
const MIN_FILL_MS = Number(process.env.FORM_MIN_FILL_MS ?? 20_000);
const MAX_FILL_MS = 6 * 60 * 60 * 1000; // Stale form; make them reload.

function secret(): string {
  const value = process.env.FORM_TOKEN_SECRET;
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error("FORM_TOKEN_SECRET must be set in production");
  }
  // Development only, and only ever reached when NODE_ENV is not production.
  return "dev-insecure-form-token-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueFormToken(now: number = Date.now()): string {
  const payload = String(now);
  return `${payload}.${sign(payload)}`;
}

export type FormTokenResult =
  | { ok: true; issuedAt: number }
  | { ok: false; reason: "malformed" | "bad_signature" | "too_fast" | "expired" };

export function verifyFormToken(token: string, now: number = Date.now()): FormTokenResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const [payload, signature] = parts as [string, string];
  const issuedAt = Number(payload);
  if (!Number.isInteger(issuedAt)) return { ok: false, reason: "malformed" };

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  const elapsed = now - issuedAt;
  if (elapsed < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (elapsed > MAX_FILL_MS) return { ok: false, reason: "expired" };

  return { ok: true, issuedAt };
}

export const FORM_TOKEN_LIMITS = { MIN_FILL_MS, MAX_FILL_MS };
