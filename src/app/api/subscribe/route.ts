import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/resend";
import { dayStamp } from "@/lib/security/identity";
import { hasSubscriberDatabase } from "@/lib/subscribers/client";
import { subscribe } from "@/lib/subscribers/repository";
import { looksLikeEmail, normaliseEmail, tokenFor } from "@/lib/subscribers/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Joins the notification list.
 *
 * A separate request from `/api/response`, made minutes later on a different
 * page, writing to a different database. Nothing here knows a survey was ever
 * submitted, and nothing in the response payload knows this exists.
 *
 * The reply is identical whether the address is new, pending or already
 * subscribed — telling a stranger which would leak list membership to anyone
 * who tried an address.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const email = (payload as { email?: unknown }).email;
  if (typeof email !== "string" || !looksLikeEmail(email)) {
    return NextResponse.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }

  if (!hasSubscriberDatabase()) {
    return NextResponse.json(
      { error: "The notification list is not available right now." },
      { status: 503 },
    );
  }

  const address = normaliseEmail(email);
  const result = await subscribe(address, dayStamp());

  if (result !== "already_confirmed") {
    // Double opt-in. Sent immediately, which is also why the sender name is
    // recognised when the results blast arrives a year later.
    const link = `${SITE_URL}/api/subscribe/confirm?email=${encodeURIComponent(address)}&token=${tokenFor(address, "confirm")}`;
    await sendEmail({
      to: address,
      subject: "Confirm your whatweearn notification",
      text: [
        "Someone asked us to email this address when the whatweearn results publish.",
        "",
        "If that was you, confirm here:",
        link,
        "",
        "If it wasn't, ignore this — we will not email you again, and the address is",
        "deleted within a fortnight.",
        "",
        "We can never email you about your own survey answers: your address is kept in a",
        "different database with no link back to them.",
      ].join("\n"),
    });
  }

  return NextResponse.json({ ok: true });
}
