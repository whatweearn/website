import { describe, expect, it } from "vitest";

import {
  COUNTRY_PUBLISH_MIN,
  MIN_CELL_SIZE,
  TRIM_LOWER_PERCENTILE,
  TRIM_UPPER_PERCENTILE,
  isCellPublishable,
  isCountryPublishable,
  responsesUntilPublish,
} from "./thresholds";

describe("threshold values", () => {
  it("suppresses cells below five, which is the privacy promise on the site", () => {
    expect(MIN_CELL_SIZE).toBe(5);
  });

  it("publishes countries at sixty, which is the statistical promise on the site", () => {
    expect(COUNTRY_PUBLISH_MIN).toBe(60);
  });

  it("keeps the privacy floor well below the publication floor", () => {
    // They serve different purposes. If these ever converge, someone has
    // conflated the privacy rule with the sample-size rule.
    expect(MIN_CELL_SIZE).toBeLessThan(COUNTRY_PUBLISH_MIN);
  });

  it("trims symmetrically", () => {
    expect(TRIM_LOWER_PERCENTILE + TRIM_UPPER_PERCENTILE).toBe(100);
  });
});

describe("isCellPublishable", () => {
  it("withholds immediately below the threshold", () => {
    expect(isCellPublishable(MIN_CELL_SIZE - 1)).toBe(false);
  });

  it("publishes exactly at the threshold", () => {
    expect(isCellPublishable(MIN_CELL_SIZE)).toBe(true);
  });

  it("withholds an empty cell", () => {
    expect(isCellPublishable(0)).toBe(false);
  });
});

describe("isCountryPublishable", () => {
  it("withholds immediately below the threshold", () => {
    expect(isCountryPublishable(COUNTRY_PUBLISH_MIN - 1)).toBe(false);
  });

  it("publishes exactly at the threshold", () => {
    expect(isCountryPublishable(COUNTRY_PUBLISH_MIN)).toBe(true);
  });
});

describe("responsesUntilPublish", () => {
  it("counts the remaining gap", () => {
    expect(responsesUntilPublish(41)).toBe(19);
  });

  it("clamps at zero once published, never going negative", () => {
    expect(responsesUntilPublish(COUNTRY_PUBLISH_MIN)).toBe(0);
    expect(responsesUntilPublish(COUNTRY_PUBLISH_MIN + 500)).toBe(0);
  });
});

describe("input validation", () => {
  it.each([
    ["negative", -1],
    ["fractional", 4.5],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("rejects a %s response count", (_label, value) => {
    // A bad count must never quietly resolve to "publishable".
    expect(() => isCellPublishable(value)).toThrow(RangeError);
    expect(() => isCountryPublishable(value)).toThrow(RangeError);
    expect(() => responsesUntilPublish(value)).toThrow(RangeError);
  });
});
