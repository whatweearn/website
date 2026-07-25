import { describe, expect, it } from "vitest";

import { type EmailContent, renderEmail } from "./template";

const base: EmailContent = {
  preheader: "One click to confirm.",
  heading: "Confirm your notification",
  paragraphs: ["First paragraph.", "Second paragraph."],
  action: { label: "Confirm this address", url: "https://whatweearn.eu/confirm?token=abc" },
  note: "Ignore this if it was not you.",
};

describe("the two parts stay in step", () => {
  it("puts every paragraph in both", () => {
    // Writing HTML and text separately is how a link gets updated in one and
    // not the other. Both come from the same content here.
    const { html, text } = renderEmail(base);
    for (const p of base.paragraphs) {
      expect(html).toContain(p);
      expect(text).toContain(p);
    }
  });

  it("puts the action URL in both", () => {
    const { html, text } = renderEmail(base);
    expect(html).toContain(base.action!.url);
    expect(text).toContain(base.action!.url);
  });

  it("puts the unsubscribe link in both when there is one", () => {
    const { html, text } = renderEmail({ ...base, unsubscribeUrl: "https://x.test/u?t=1" });
    expect(html).toContain("https://x.test/u?t=1");
    expect(text).toContain("https://x.test/u?t=1");
  });

  it("omits unsubscribe from transactional mail", () => {
    // A confirmation is not a subscription; offering to unsubscribe from
    // something not yet subscribed to is confusing.
    const { html, text } = renderEmail(base);
    expect(html).not.toContain("Unsubscribe");
    expect(text).not.toContain("Unsubscribe");
  });
});

describe("survives real email clients", () => {
  it("loads nothing from anywhere", () => {
    // Remote images are blocked by default, and a tracking pixel would
    // contradict the privacy page. There are none, so nothing to block.
    const { html } = renderEmail(base);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/@import/);
  });

  it("lays out with tables, which is the only thing that works everywhere", () => {
    const { html } = renderEmail(base);
    expect(html).toContain('role="presentation"');
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
  });

  it("styles inline, with the stylesheet reserved for dark overrides", () => {
    // The original rule here was "no <style> at all". That was right in spirit
    // and wrong absolutely: a media query cannot live in a style attribute, so
    // dark mode is impossible without one. The rule is now that the block adds
    // only appearance, never legibility — asserted in the dark-mode tests.
    const { html } = renderEmail(base);
    expect(html).toMatch(/style="[^"]*font-size/);
  });

  it("carries a preheader so the inbox preview is not scavenged text", () => {
    const { html } = renderEmail(base);
    expect(html).toContain(base.preheader);
    expect(html).toMatch(/display:none;max-height:0/);
  });

  it("declares support for both colour schemes", () => {
    const { html } = renderEmail(base);
    expect(html).toContain('name="color-scheme"');
    expect(html).toContain('name="supported-color-schemes"');
  });

  it("offers the link as text too, for clients that mangle buttons", () => {
    const { html } = renderEmail(base);
    expect(html).toMatch(/paste this into your browser/i);
  });
});

describe("no footer", () => {
  it("carries no sender block", () => {
    const { html, text } = renderEmail(base);
    expect(html).not.toMatch(/Sent by/);
    expect(text).not.toMatch(/Sent by/);
    expect(html).not.toMatch(/Who we are/);
  });

  it("still offers a way out of a broadcast", () => {
    // The footer went; the opt-out did not. List-Unsubscribe covers modern
    // clients but not all, and an unsubscribe nobody can find is how a list
    // collects spam complaints instead.
    const { html, text } = renderEmail({ ...base, unsubscribeUrl: "https://x.test/u?t=1" });
    expect(html).toContain("https://x.test/u?t=1");
    expect(text).toContain("https://x.test/u?t=1");
  });

  it("adds nothing to transactional mail", () => {
    const { html } = renderEmail(base);
    expect(html).not.toMatch(/Unsubscribe/);
  });
});

describe("dark mode", () => {
  it("supplies dark styles, not just a declaration of support", () => {
    // Declaring color-scheme without dark styles is worse than not declaring
    // it: Apple Mail darkened the card and left the inline text dark, so the
    // message arrived as dark grey on near-black.
    const { html } = renderEmail(base);
    expect(html).toMatch(/@media \(prefers-color-scheme: dark\)/);
  });

  it("keeps everything needed for legibility inline", () => {
    // The style block is progressive enhancement. Gmail strips it in places,
    // and the light version must survive that intact.
    const { html } = renderEmail(base);
    const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    expect(styleBlock).toMatch(/prefers-color-scheme/);
    // Nothing outside the dark media query, comments aside.
    const rules = styleBlock.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[\s\S]*/, "");
    expect(rules.trim()).toBe("");
    expect(html).toMatch(/style="[^"]*color:#/);
  });
});

describe("escaping", () => {
  it("escapes content rather than emitting it raw", () => {
    const { html } = renderEmail({
      ...base,
      heading: 'A "quoted" <thing> & more',
      action: { label: "Go", url: "https://x.test/?a=1&b=2" },
    });
    expect(html).toContain("&lt;thing&gt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<thing>");
  });

  it("leaves the plain-text part unescaped, because it is not markup", () => {
    const { text } = renderEmail({ ...base, heading: "A <thing> & more" });
    expect(text).toContain("A <thing> & more");
  });
});
