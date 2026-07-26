import { describe, expect, it } from "vitest";

import { INVITE_MESSAGE, gapMessage } from "./share";

/**
 * This is the only copy on the site that goes out under someone else's name,
 * on their own timeline, to people who have never heard of us. A message that
 * reads as marketing does not get posted, and one that overclaims makes the
 * person who posted it look careless. Both failures are silent, so they get
 * asserted here.
 */

describe("the invite", () => {
  it("tells the reader what they get, not how we are doing", () => {
    // The first version led with how far some country was from publishing,
    // which asks a stranger to care about our progress bar. Worse, the country
    // was whichever happened to be nearest the threshold, so a reader in
    // Poland was being told about the United Kingdom.
    expect(INVITE_MESSAGE).toMatch(/you find out/);
    expect(INVITE_MESSAGE).not.toMatch(/answers away|needs \d+|before its median/);
  });

  it("stays in the third person, because the reader may not have answered", () => {
    // The landing page and the explorer are both read by people who have not
    // taken the survey. Putting "I just added my salary" in their mouth is the
    // one thing guaranteed to stop them sending it.
    expect(INVITE_MESSAGE).not.toMatch(/\bI\b|\bmy\b/);
  });
});

describe("gapMessage", () => {
  it("offers the reader the number, not a request for help", () => {
    expect(gapMessage("Germany", 51, false)).toMatch(/before any of us can see what it really pays/);
    expect(gapMessage("Germany", 0, true)).toMatch(/you find out what your job and level/);
  });

  it("names the sharer's own country, which is the network they post into", () => {
    expect(gapMessage("Germany", 51, false)).toContain("Germany needs 51 more");
    expect(gapMessage("Germany", 0, true)).toContain("in Germany");
  });

  it("drops the countdown once a country has published", () => {
    // "needs 0 more" is the failure this guards, and it reads as broken copy.
    expect(gapMessage("Germany", 0, true)).not.toMatch(/needs \d+|\d+ more/);
  });

  it("gives the two countries that need one a definite article", () => {
    // "United Kingdom needs 58 more" is the sort of thing that makes a reader
    // assume the whole page was machine-written.
    expect(gapMessage("Netherlands", 40, false)).toContain("the Netherlands needs");
    // ...and never at the start of a sentence, where that lowercase article
    // would read just as wrong in the other direction.
    for (const country of ["Netherlands", "United Kingdom"]) {
      for (const message of [gapMessage(country, 9, false), gapMessage(country, 0, true)]) {
        expect(message, message).not.toMatch(/(^|\. )the /);
      }
    }
    expect(gapMessage("United Kingdom", 0, true)).toContain("in the United Kingdom");
    expect(gapMessage("Germany", 40, false)).not.toContain("the Germany");
  });

  it("never promises we can email somebody about their own answers", () => {
    // §4.8: structurally impossible. The share message is read by people who
    // have just been told that, so contradicting it here is worse than vague.
    for (const message of [gapMessage("Spain", 12, false), gapMessage("Spain", 0, true)]) {
      expect(message).not.toMatch(/we.ll (email|tell) you/i);
    }
  });
});

describe("every message", () => {
  const all = [INVITE_MESSAGE, gapMessage("Germany", 51, false), gapMessage("Germany", 0, true)];

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
      expect(message.length + 24, message).toBeLessThanOrEqual(280);
    }
  });

  it("says what the thing is, since most readers arrive with no context", () => {
    for (const message of all) {
      expect(message).toContain("whatweearn");
      expect(message).toMatch(/salary survey/);
    }
  });

  it("says the two minutes, which is the whole objection being answered", () => {
    for (const message of all) {
      expect(message).toMatch(/two minutes/i);
    }
  });
});
