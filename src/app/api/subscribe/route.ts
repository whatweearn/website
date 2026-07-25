import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/resend";
import { renderEmail } from "@/lib/email/template";
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
    const { html, text } = renderEmail({
      preheader: "One click to confirm, and we will not write again until there is something to say.",
      heading: "Confirm your notification",
      paragraphs: [
        "Someone asked us to email this address when the whatweearn results publish. If that was you, confirm below.",
        "We will write twice a year at most: once when results publish, once when the survey reopens.",
      ],
      action: { label: "Confirm this address", url: link },
      note:
        "If this was not you, ignore it — nothing is stored until you confirm, and the address is deleted within a fortnight. " +
        "We can never email you about your own survey answers: your address is kept in a separate database with no link back to them.",
    });

    const sent = await sendEmail({
      to: address,
      subject: "Confirm your whatweearn notification",
      text,
      html,
    });

    // Development only: hand back the link so the opt-in flow can be walked
    // through before DNS and a Resend key exist. Gated on NODE_ENV, so a
    // production build cannot return a confirmation token to a caller.
    if (sent.ok && sent.skipped && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, devLink: link });
    }

    if (!sent.ok) {
      // Telling somebody to check an inbox nothing was sent to is worse than
      // an error: they wait, nothing arrives, and the address expires
      // unconfirmed. The pending row stays, so a retry simply sends again.
      return NextResponse.json(
        { error: "We could not send the confirmation email just now. Please try again shortly." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
