import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Assertions against the real prerendered output.
 *
 * Source-level checks were tried first and are the wrong tool: JSX silently
 * rewrites whitespace between the file and the page, so the only honest place
 * to catch it is the HTML itself.
 *
 * Requires a prior `next build`, which is why CI builds before it tests.
 * They skip rather than fail on a cold checkout, so `pnpm test` still works
 * locally without a build — but CI always exercises them.
 */
const HTML_PATH = join(process.cwd(), ".next/server/app/index.html");
const built = existsSync(HTML_PATH);
const html = built ? readFileSync(HTML_PATH, "utf8") : "";

/**
 * Text a visitor actually sees. Script and style payloads are stripped because
 * they legitimately contain words like "undefined" that would be a bug in copy
 * but are normal in a bundle.
 */
const visibleText = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ");

describe.skipIf(!built)("prerendered markup", () => {
  it("keeps a space between inline formatting and the text after it", () => {
    // JSX trims the first line of a text node, so `</b> word` at a line
    // ending loses its space and renders "extra:after". Invisible in review,
    // obvious on the page. Bit this project twice.
    const collisions = [...html.matchAll(/<\/(b|em|strong|i|code)>[A-Za-z]/g)].map((m) => m[0]);
    expect(collisions).toEqual([]);
  });

  it("keeps a space between a number and the word it qualifies", () => {
    // The same trimming produces "60responses" when an interpolation ends a
    // line. Catch any digit run butting straight into a letter.
    const glued = [...html.matchAll(/>[^<]*?\d(?:responses|questions|more|minutes)\b/g)].map(
      (m) => m[0],
    );
    expect(glued).toEqual([]);
  });

  it("shows no unresolved value in visible copy", () => {
    expect(visibleText).not.toContain("undefined");
    expect(visibleText).not.toContain("NaN");
    expect(visibleText).not.toMatch(/\{[A-Z_]{3,}\}/);
  });

  it("carries the metadata a real deployment needs", () => {
    expect(html).toMatch(/<meta name="description"/);
    expect(html).toMatch(/<meta property="og:title"/);
    expect(html).toMatch(/rel="canonical"/);
    expect(html).toMatch(/<html lang="en"/);
  });

  it("publishes no figure it did not collect", () => {
    // The design comp's placeholders. None of them may ever reach a build.
    for (const invented of ["14,206", "€115,000", "€83,500", "€73,500", "€68,700"]) {
      expect(html).not.toContain(invented);
    }
  });
});
