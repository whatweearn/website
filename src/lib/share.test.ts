import { describe, expect, it } from "vitest";

import { GENERAL_MESSAGE, gapMessage, shareMessageFor } from "./share";
import type { CountryRow } from "./stats";
import { COUNTRY_PUBLISH_MIN } from "./thresholds";

/**
 * This is the only copy on the site that goes out under someone else's name,
 * on their own timeline, to people who have never heard of us. A message that
 * reads as marketing does not get posted, and a message that overclaims makes
 * the person who posted it look careless. Both failures are silent, so they
 * get asserted here.
 */

function country(over: Partial<CountryRow> = {}): CountryRow {
  return {
    name: "Germany",
    currency: "EUR",
    responses: 9,
    median: null,
    p25: null,
    p75: null,
    ...over,
  };
}

describe("gapMessage", () => {
  it("names the gap, not the achievement", () => {
    const message = gapMessage("Germany", 51, false);
    expect(message).toContain("Germany needs 51 more before its median publishes");
  });

  it("switches to the sharper-figures framing once a country has published", () => {
    const message = gapMessage("Germany", 0, true);
    // "needs 0 more" is the failure this guards, and it reads as broken copy.
    expect(message).not.toMatch(/needs \d+ more/);
    expect(message).toContain("already up");
  });

  it("never promises we can email somebody about their own answers", () => {
    // §4.8: structurally impossible. The share message is read by people who
    // have just been told that, so contradicting it here is worse than vague.
    for (const message of [gapMessage("Spain", 12, false), gapMessage("Spain", 0, true)]) {
      expect(message).not.toMatch(/we.ll (email|tell) you/i);
    }
  });
});

describe("shareMessageFor", () => {
  it("stays in the third person, because the reader may not have answered", () => {
    // The landing page and the explorer are both read by people who have not
    // taken the survey. Putting "I just added my salary" in their mouth is the
    // one thing guaranteed to stop them sending it.
    const message = shareMessageFor(country());
    expect(message).not.toMatch(/\bI\b|\bmy\b/);
  });

  it("names the country nearest to publishing and how far it has to go", () => {
    expect(shareMessageFor(country({ responses: 9 }))).toContain(
      `Germany is ${COUNTRY_PUBLISH_MIN - 9} answers away`,
    );
  });

  it("gives the two countries that need one a definite article", () => {
    // "United Kingdom is 58 answers away" is the sort of thing that makes a
    // reader assume the whole page was machine-written, and this copy goes out
    // under their name.
    expect(shareMessageFor(country({ name: "United Kingdom" }))).toContain("the United Kingdom is");
    expect(gapMessage("Netherlands", 40, false)).toContain("the Netherlands needs");
    expect(gapMessage("Germany", 40, false)).not.toContain("the Germany");
  });

  it("falls back to the general message when nothing is close", () => {
    expect(shareMessageFor(undefined)).toBe(GENERAL_MESSAGE);
    // A country already over the line has no gap to close, so naming it would
    // ask for help with something already done.
    expect(shareMessageFor(country({ responses: COUNTRY_PUBLISH_MIN }))).toBe(GENERAL_MESSAGE);
  });
});

describe("every message", () => {
  const all = [
    GENERAL_MESSAGE,
    gapMessage("Germany", 51, false),
    gapMessage("Germany", 0, true),
    shareMessageFor(country()),
  ];

  it("carries no em dashes", () => {
    // House style for shared copy: it has to read like a person typing, and an
    // em dash is the single strongest tell that it was not.
    for (const message of all) {
      expect(message).not.toMatch(/[—–]/);
    }
  });

  it("stays short enough for the strictest channel", () => {
    // X counts a URL as 23 characters regardless of length.
    for (const message of all) {
      expect(message.length + 24).toBeLessThanOrEqual(280);
    }
  });

  it("says what the thing is, since most readers arrive with no context", () => {
    for (const message of all) {
      expect(message).toContain("whatweearn");
      expect(message).toMatch(/salary survey/);
    }
  });
});
