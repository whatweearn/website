const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "missing_token" | "rejected" | "unreachable" };

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Verifies a Turnstile token server side.
 *
 * Fails **open** when no secret is configured, so local development and tests
 * work without Cloudflare credentials — but only outside production. In
 * production a missing secret is a configuration error, not a reason to accept
 * unverified submissions, so it fails closed.
 *
 * A network failure reaching Cloudflare also fails closed. Losing a submission
 * is recoverable; letting an automated flood through and poisoning the medians
 * is not.
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") return { ok: false, reason: "rejected" };
    return { ok: true, skipped: true };
  }

  if (!token) return { ok: false, reason: "missing_token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success ? { ok: true, skipped: false } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
