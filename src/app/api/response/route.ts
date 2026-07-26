import { NextResponse } from "next/server";

import { getRepository } from "@/lib/repository";
import { clientAddress, dayStamp, sameDayHandle } from "@/lib/security/identity";
import { verifyFormToken } from "@/lib/security/formToken";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { implausibilities, submissionSchema } from "@/lib/survey/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accepts a survey response.
 *
 * Returns 204 and **nothing else**. No id, no token, no echo of the payload —
 * there must be no value the client could later present to link itself back to
 * this row. That is what makes the separate email store in §4 meaningful.
 *
 * Layered defences, cheapest first:
 *   1. honeypot        — free, catches naive bots
 *   2. form token      — server-signed, so the timing floor cannot be forged
 *   3. rate limit      — same-day handle, never an address
 *   4. Turnstile       — the one that stops a motivated attacker
 *   5. schema          — bounded choices only
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some answers were not in a form we can accept." },
      { status: 400 },
    );
  }

  const { response, formToken, turnstileToken, website } = parsed.data;

  // 1. Honeypot. Silent 204: telling a bot why it failed only helps it.
  if (website) return new NextResponse(null, { status: 204 });

  // 2. Was this form served by us, and long enough ago to have been filled in?
  const token = verifyFormToken(formToken);
  if (!token.ok) {
    const status = token.reason === "expired" ? 410 : 400;
    const error =
      token.reason === "expired"
        ? "This form has been open too long. Reload and your answers will still be here."
        : token.reason === "too_fast"
          ? "That was faster than the form can be filled in."
          : "This form could not be verified. Reload and try again.";
    return NextResponse.json({ error }, { status });
  }

  // Hashed immediately; the address itself is never stored or logged.
  const address = clientAddress(request.headers);
  const handle = sameDayHandle(address, request.headers.get("user-agent") ?? "");

  // 3. Rate limit.
  const limit = checkRateLimit(handle);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is more submissions than we accept from one place in an hour." },
      { status: 429, headers: { "retry-after": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  // 4. Turnstile. Fails closed in production, including when unreachable.
  const turnstile = await verifyTurnstile(turnstileToken, address);
  if (!turnstile.ok) {
    // "Try again" is only honest advice when trying again might work. A
    // missing token means the browser check never ran — usually an extension
    // or a network filter blocking challenges.cloudflare.com — and resubmitting
    // the same form will fail identically. Say what would actually change it.
    return NextResponse.json(
      {
        error:
          turnstile.reason === "missing_token"
            ? "Your browser never completed the Cloudflare check, so we cannot accept this yet. It is almost always an extension or network filter blocking challenges.cloudflare.com. Your answers are saved on this device — allow that domain, reload, and they will still be here."
            : "We could not confirm this submission came from a browser. Please try again.",
      },
      { status: 403 },
    );
  }

  const repository = getRepository();

  // A duplicate is not an error worth surfacing — the visitor gets the same
  // confirmation either way, and we quietly keep the first answer.
  if (await repository.hasSubmittedToday(handle)) {
    return new NextResponse(null, { status: 204 });
  }

  await repository.save({
    response,
    submittedOn: dayStamp(),
    handle,
    flags: implausibilities(response),
  });

  return new NextResponse(null, { status: 204 });
}
