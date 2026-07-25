import { getController } from "../legal";

/**
 * Email rendering.
 *
 * ## Why hand-written HTML
 *
 * Email is not the web. There is no flexbox, no external stylesheet, no
 * webfont worth relying on, and Outlook renders through Word. Tables and
 * inline styles are not nostalgia, they are the only things that work
 * everywhere.
 *
 * ## Why one definition produces both parts
 *
 * A multipart message carries an HTML body and a plain-text body. Writing them
 * separately is how they end up saying different things — a link updated in
 * one and not the other, a paragraph added to the pretty version only. Here
 * both are derived from the same content, so they cannot disagree.
 *
 * ## Why it looks restrained
 *
 * This project asks strangers to trust it with their salary. An email with a
 * banner image and three calls to action reads as marketing, which is exactly
 * the wrong signal — and image-heavy mail is both blocked by default and worse
 * for deliverability. No images at all here: the wordmark is type, so it can
 * simply be typed.
 */

export type EmailContent = {
  /** The grey preview line inbox lists show after the subject. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Smaller text after the action — caveats, what happens if they ignore it. */
  note?: string;
  /** Adds a visible unsubscribe line. Omit for transactional mail. */
  unsubscribeUrl?: string;
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Content is ours, not user input — but an unescaped address would still break the markup. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

const INK = "#1b1d22";
const MUTED = "#5e6068";
const FAINT = "#8d9098";
const CORAL = "#c3422d";
const PAPER = "#fcfcfa";
const CARD = "#ffffff";
const LINE = "#e9e6e2";

// System stack only. A webfont in email either fails to load or is stripped,
// and the fallback is what most people see anyway.
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function senderLine(): string {
  const controller = getController();
  if (!controller) return "whatweearn";
  return [controller.name, controller.address].filter(Boolean).join(", ");
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const sender = senderLine();

  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MUTED};">${esc(p)}</p>`,
    )
    .join("");

  const action = content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
         <tr><td style="border-radius:999px;background:${CORAL};">
           <a href="${esc(content.action.url)}"
              style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;
                     font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">
             ${esc(content.action.label)}
           </a>
         </td></tr>
       </table>
       <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:${FAINT};word-break:break-all;">
         Or paste this into your browser:<br />${esc(content.action.url)}
       </p>`
    : "";

  const note = content.note
    ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};
                font-size:13px;line-height:1.6;color:${FAINT};">${esc(content.note)}</p>`
    : "";

  const unsubscribe = content.unsubscribeUrl
    ? `<br /><a href="${esc(content.unsubscribeUrl)}" style="color:${FAINT};">Unsubscribe</a> —
       one click, no questions.`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<!-- Preheader: shown in the inbox list next to the subject, never on the page.
     Without it, clients pad the preview with whatever text comes first. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${esc(content.preheader)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:${PAPER};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:520px;background:${CARD};border:1px solid ${LINE};
                    border-radius:14px;padding:32px;font-family:${FONT};">
        <tr><td>
          <p style="margin:0 0 24px;font-size:17px;font-weight:600;letter-spacing:-0.02em;color:${INK};">
            what<span style="color:${CORAL};">we</span>earn
          </p>

          <h1 style="margin:0 0 16px;font-size:21px;line-height:1.25;font-weight:600;
                     letter-spacing:-0.02em;color:${INK};">${esc(content.heading)}</h1>

          ${paragraphs}
          ${action}
          ${note}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:520px;padding:20px 32px;font-family:${FONT};">
        <tr><td style="font-size:12px;line-height:1.6;color:${FAINT};">
          Sent by ${esc(sender)}.${unsubscribe}
        </td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    "",
    ...content.paragraphs.flatMap((p) => [p, ""]),
    ...(content.action ? [content.action.label + ":", content.action.url, ""] : []),
    ...(content.note ? [content.note, ""] : []),
    "—",
    `Sent by ${sender}.`,
    ...(content.unsubscribeUrl ? [`Unsubscribe: ${content.unsubscribeUrl}`] : []),
  ].join("\n");

  return { html, text };
}
