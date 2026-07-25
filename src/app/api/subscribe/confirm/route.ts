import { NextResponse } from "next/server";

import { dayStamp } from "@/lib/security/identity";
import { hasSubscriberDatabase } from "@/lib/subscribers/client";
import { confirm } from "@/lib/subscribers/repository";
import { verifyToken } from "@/lib/subscribers/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completes the double opt-in.
 *
 * A GET because it is followed from an email client. That makes it
 * prefetchable, which is acceptable here: confirming twice is harmless, and
 * the alternative — an interstitial page with a button — costs real
 * confirmations for no gain.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  if (!email || !token || !verifyToken(email, "confirm", token)) {
    return NextResponse.redirect(new URL("/subscribed?state=invalid", url.origin));
  }

  if (!hasSubscriberDatabase()) {
    return NextResponse.redirect(new URL("/subscribed?state=unavailable", url.origin));
  }

  await confirm(email, dayStamp());
  // The same page whether this confirmed a pending address or one already
  // confirmed — the person cannot tell, and does not need to.
  return NextResponse.redirect(new URL("/subscribed?state=confirmed", url.origin));
}
