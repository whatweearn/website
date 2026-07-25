import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "globals.css"), "utf8");

/**
 * Guards the failure mode flagged in CLAUDE.md §10: theming that is silently
 * half-broken. Each of these has a specific way of going wrong that produces
 * no error, no warning, and no visible problem in whichever theme the
 * developer happens to be using.
 */
describe("theme tokens", () => {
  it("uses `@theme inline`, without which utilities bake in resolved values", () => {
    // The difference between working theme switching and none at all.
    expect(css).toMatch(/@theme\s+inline\s*\{/);
  });

  it("declares an explicit block for both attribute values", () => {
    // Restating light is not redundant: without it, data-theme="light" cannot
    // override an OS dark preference, and the toggle only works one way.
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it("puts the attribute blocks after the media query so they win", () => {
    const media = css.indexOf("@media (prefers-color-scheme: dark)");
    const light = css.indexOf(':root[data-theme="light"]');
    const dark = css.indexOf(':root[data-theme="dark"]');

    expect(media).toBeGreaterThan(-1);
    expect(light).toBeGreaterThan(media);
    expect(dark).toBeGreaterThan(media);
  });

  it("defines every colour token in all four theme blocks", () => {
    // Four, not three: the light default, the dark media query, and the two
    // attribute overrides. Each must carry the complete set.
    const blocks = [...css.matchAll(/(?::root\[data-theme="(?:light|dark)"\]|:root)\s*\{([^}]*)\}/g)]
      .map((m) => m[1])
      .filter((body) => body.includes("--wwe-bg"));

    expect(blocks.length).toBe(4);

    const names = blocks.map(
      (body) => new Set([...body.matchAll(/(--wwe-[a-z0-9-]+):/g)].map((m) => m[1])),
    );
    // A token missing from one theme inherits the other's value and quietly
    // produces an unreadable pairing.
    for (const set of names.slice(1)) {
      expect([...names[0]!].filter((token) => !set.has(token))).toEqual([]);
    }
  });
});
