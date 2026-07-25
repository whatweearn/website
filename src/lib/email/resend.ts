/**
 * Email delivery.
 *
 * Resend is used as a **transport only**. We never call its Audiences or
 * Contacts endpoints, and that is not a stylistic preference:
 *
 *   - Resend stores account data, contacts and logs in the United States
 *     regardless of the sending region. Keeping the list solely in our own
 *     EU database means only the addresses we are actively mailing cross that
 *     boundary, rather than the whole list sitting there permanently.
 *   - One source of truth means one deletion path. An erasure request that
 *     has to be honoured in two systems is an erasure request that eventually
 *     gets honoured in one.
 *   - It keeps the swap to SES `eu-central-1` a small change if zero-asterisk
 *     EU residency is ever required.
 *
 * `email.test.ts` asserts this file never references those endpoints.
 */

const SEND_URL = "https://api.resend.com/emails";

export type Message = {
  to: string;
  subject: string;
  /** Plain-text part. Always sent — see the note in template.ts. */
  text: string;
  /** HTML part. Sent alongside the text, never instead of it. */
  html?: string;
  /** Adds RFC 8058 one-click unsubscribe headers. */
  unsubscribeUrl?: string;
};

export type SendResult =
  /** `skipped` means nothing was actually sent — development without credentials. */
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: Message): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // A link to localhost is worthless in somebody's inbox, and the failure is
  // silent: the message sends, looks right, and every recipient hits a dead
  // link. Refusing to send is the smaller harm, and it surfaces the missing
  // NEXT_PUBLIC_SITE_URL immediately instead of after a launch.
  if (process.env.NODE_ENV === "production") {
    const body = `${message.text}${message.html ?? ""}`;
    if (/localhost|127\.0\.0\.1/.test(body)) {
      return { ok: false, reason: "link_points_at_localhost" };
    }
  }

  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "email_not_configured" };
    }
    // Development: log the link rather than swallowing it, so the opt-in flow
    // can be walked through without credentials.
    console.info(`[email] would send "${message.subject}" to ${message.to}\n${message.text}`);
    return { ok: true, skipped: true };
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };

  const body: Record<string, unknown> = {
    from,
    to: [message.to],
    subject: message.subject,
    // Multipart. Some people read plain text by preference, some clients
    // strip HTML, and a text part measurably helps deliverability — an
    // HTML-only message is a spam signal.
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  };

  if (message.unsubscribeUrl) {
    // RFC 8058: lets a mail client unsubscribe without the person opening
    // anything, which is both good manners and good for deliverability.
    body.headers = {
      "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true, skipped: false };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
