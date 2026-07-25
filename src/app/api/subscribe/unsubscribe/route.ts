import { NextResponse } from "next/server";

import { dayStamp } from "@/lib/security/identity";
import { hasSubscriberDatabase } from "@/lib/subscribers/client";
import { unsubscribe } from "@/lib/subscribers/repository";
import { verifyToken } from "@/lib/subscribers/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function remove(email: string | null, token: string | null): Promise<boolean> {
  if (!email || !token || !verifyToken(email, "unsubscribe", token)) return false;
  if (!hasSubscriberDatabase()) return false;
  await unsubscribe(email, dayStamp());
  return true;
}

/** Followed from a link in an email. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const done = await remove(url.searchParams.get("email"), url.searchParams.get("token"));
  return NextResponse.redirect(
    new URL(`/subscribed?state=${done ? "removed" : "invalid"}`, url.origin),
  );
}

/**
 * RFC 8058 one-click unsubscribe.
 *
 * Mail clients POST here directly from their own interface. Honouring it is
 * both good manners and materially better for deliverability than making
 * someone hunt for a link — and this list sits idle for months at a time,
 * which is exactly when people reach for "mark as spam" instead.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  await remove(url.searchParams.get("email"), url.searchParams.get("token"));
  // Always 200: an unsubscribe that reports failure invites a retry loop, and
  // the outcome is the same either way.
  return new NextResponse(null, { status: 200 });
}
