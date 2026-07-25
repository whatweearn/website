import { SITE_URL, getController } from "../legal";

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
 * ## Dark mode
 *
 * Declaring `color-scheme: light dark` tells Apple Mail we handle dark
 * ourselves. Declaring it *without* supplying dark styles is worse than not
 * declaring it at all: Mail darkened the card and left the inline text colours
 * alone, so the message arrived as dark grey on near-black.
 *
 * Media queries cannot live in a style attribute, so this needs a `<style>`
 * block — and that block contains dark overrides only. Everything required for
 * the message to be readable stays inline, so a client that strips `<style>`
 * (Gmail does, in places) still gets the complete light version.
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

/**
 * Dark equivalents.
 *
 * Not an inversion — the coral is lifted so it still reads against a dark
 * ground, and the button takes dark text on bright coral exactly as the site
 * does.
 */
const DARK = {
  paper: "#131417",
  card: "#1b1d21",
  line: "#2a2d33",
  ink: "#f1f0ed",
  muted: "#a8abb2",
  faint: "#898c96",
  coral: "#ff8f79",
} as const;

// System stack only. A webfont in email either fails to load or is stripped,
// and the fallback is what most people see anyway.
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Who sent this, at the level the message actually calls for.
 *
 * A postal address belongs on a *broadcast* — unsolicited commercial mail is
 * expected to identify its sender that fully, and a recipient who did not ask
 * for it deserves to see who did. A confirmation somebody requested thirty
 * seconds earlier is transactional, and pasting a company's street address
 * into it is more than the situation needs.
 *
 * Both name the company and link to the imprint, which carries the address in
 * full, so the information is always one click away.
 */
function senderLine(content: EmailContent): { html: string; text: string } {
  const controller = getController();
  const name = controller?.name ?? "whatweearn";
  const imprint = `${SITE_URL}/imprint`;

  // The unsubscribe line marks a broadcast: transactional mail has none.
  const isBroadcast = Boolean(content.unsubscribeUrl);
  const postal = isBroadcast && controller?.address ? `, ${controller.address}` : "";

  return {
    html: `Sent by ${esc(name)}${esc(postal)}. <a href="${esc(imprint)}">Who we are</a>.`,
    text: `Sent by ${name}${postal}. Who we are: ${imprint}`,
  };
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const sender = senderLine(content);

  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p class="wwe-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MUTED};">${esc(p)}</p>`,
    )
    .join("");

  const action = content.action
    ? `<table role="presentation" class="wwe-button" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
         <tr><td style="border-radius:999px;background:${CORAL};">
           <a href="${esc(content.action.url)}"
              style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;
                     font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">
             ${esc(content.action.label)}
           </a>
         </td></tr>
       </table>
       <p class="wwe-faint" style="margin:0 0 16px;font-size:12px;line-height:1.6;color:${FAINT};word-break:break-all;">
         Or paste this into your browser:<br />${esc(content.action.url)}
       </p>`
    : "";

  const note = content.note
    ? `<p class="wwe-faint wwe-rule" style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};
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
<style>
  /* Dark overrides only. Every one of these has an inline light-mode
     equivalent, so losing this block costs appearance, never legibility. */
  @media (prefers-color-scheme: dark) {
    .wwe-page  { background:${DARK.paper} !important; }
    .wwe-card  { background:${DARK.card} !important; border-color:${DARK.line} !important; }
    .wwe-ink   { color:${DARK.ink} !important; }
    .wwe-muted { color:${DARK.muted} !important; }
    .wwe-faint { color:${DARK.faint} !important; }
    .wwe-rule  { border-top-color:${DARK.line} !important; }
    .wwe-brand-we { color:${DARK.coral} !important; }
    a { color:${DARK.coral} !important; }
    .wwe-button a { color:#24100a !important; }
    /* The cell only. Painting the table too puts a square behind the
       rounded cell and squares off the button. */
    .wwe-button td { background:${DARK.coral} !important; }
  }
</style>
</head>
<body class="wwe-page" style="margin:0;padding:0;background:${PAPER};">
<!-- Preheader: shown in the inbox list next to the subject, never on the page.
     Without it, clients pad the preview with whatever text comes first. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${esc(content.preheader)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       class="wwe-page" style="background:${PAPER};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             class="wwe-card" style="max-width:520px;background:${CARD};border:1px solid ${LINE};
                    border-radius:14px;padding:32px;font-family:${FONT};">
        <tr><td>
          <p class="wwe-ink" style="margin:0 0 24px;font-size:17px;font-weight:600;letter-spacing:-0.02em;color:${INK};">
            what<span class="wwe-brand-we" style="color:${CORAL};">we</span>earn
          </p>

          <h1 class="wwe-ink" style="margin:0 0 16px;font-size:21px;line-height:1.25;font-weight:600;
                     letter-spacing:-0.02em;color:${INK};">${esc(content.heading)}</h1>

          ${paragraphs}
          ${action}
          ${note}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:520px;padding:20px 32px;font-family:${FONT};">
        <tr><td class="wwe-faint" style="font-size:12px;line-height:1.6;color:${FAINT};">
          ${sender.html}${unsubscribe}
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
    sender.text,
    ...(content.unsubscribeUrl ? [`Unsubscribe: ${content.unsubscribeUrl}`] : []),
  ].join("\n");

  return { html, text };
}
