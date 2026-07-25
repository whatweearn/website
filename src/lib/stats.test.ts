import { describe, expect, it } from "vitest";

import {
  type Distribution,
  getSiteStats,
  isPreLaunch,
  percentileAt,
  publishableCountries,
  totalCount,
} from "./stats";

/** Flat distribution: 10 bins of 10 across 0–100,000. Easy to reason about. */
const flat: Distribution = {
  n: 100,
  median: 50_000,
  lo: 0,
  hi: 100_000,
  bins: Array.from({ length: 10 }, (_, i) => ({
    lo: i * 10_000,
    hi: (i + 1) * 10_000,
    count: 10,
  })),
};

describe("percentileAt", () => {
  it("puts the midpoint of a flat distribution at the median", () => {
    expect(percentileAt(flat, 50_000)).toBe(50);
  });

  it("interpolates inside a bin rather than snapping to its edge", () => {
    // Half way through the sixth bin: 50 below it, plus half of that bin's 10.
    expect(percentileAt(flat, 55_000)).toBe(55);
  });

  it("clamps to 1 at and below the floor", () => {
    expect(percentileAt(flat, 0)).toBe(1);
    expect(percentileAt(flat, -10_000)).toBe(1);
  });

  it("clamps to 99 at and above the ceiling, never claiming 100", () => {
    expect(percentileAt(flat, 100_000)).toBe(99);
    expect(percentileAt(flat, 10_000_000)).toBe(99);
  });

  it("rises monotonically across the range", () => {
    let previous = 0;
    for (let v = 0; v <= 100_000; v += 2_500) {
      const p = percentileAt(flat, v);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });

  it("returns a floor value for an empty distribution rather than dividing by zero", () => {
    expect(percentileAt({ ...flat, bins: [] }, 50_000)).toBe(1);
  });
});

describe("totalCount", () => {
  it("sums the bins", () => {
    expect(totalCount(flat)).toBe(100);
  });
});

describe("pre-launch state", () => {
  it("ships no invented figures", async () => {
    // Guards the one rule this project cannot break: a survey whose only asset
    // is credibility must never publish numbers it did not collect.
    const stats = await getSiteStats();
    expect(stats.totalResponses).toBe(0);
    expect(stats.countriesCovered).toBe(0);
    expect(stats.europe).toBeNull();
    expect(stats.countries).toEqual([]);
    expect(isPreLaunch(stats)).toBe(true);
  });

  it("publishes no country while none has cleared the threshold", async () => {
    expect(publishableCountries(await getSiteStats())).toEqual([]);
  });
});

describe("publishableCountries", () => {
  it("keeps only countries at or above the publication threshold", () => {
    const rows = publishableCountries({
      totalResponses: 100,
      countriesCovered: 3,
      europe: null,
      countries: [
        { name: "Germany", currency: "EUR", responses: 60, median: 70_000, p25: null, p75: null },
        { name: "Portugal", currency: "EUR", responses: 59, median: null, p25: null, p75: null },
        { name: "Czechia", currency: "CZK", responses: 5, median: null, p25: null, p75: null },
      ],
    });
    expect(rows.map((r) => r.name)).toEqual(["Germany"]);
  });
});
