import { describe, expect, it } from "vitest";

import { bins, median, quantile, summarise, trim } from "./quantiles";

const oneToTen = Array.from({ length: 10 }, (_, i) => i + 1);

describe("quantile", () => {
  it("matches percentile_cont on a known sample", () => {
    // Postgres: percentile_cont(0.5) over 1..10 = 5.5, and the whole point of
    // computing this ourselves is that it must agree with the database.
    expect(quantile(oneToTen, 0.5)).toBe(5.5);
    expect(quantile(oneToTen, 0.25)).toBeCloseTo(3.25, 10);
    expect(quantile(oneToTen, 0.75)).toBeCloseTo(7.75, 10);
  });

  it("returns the endpoints at 0 and 1", () => {
    expect(quantile(oneToTen, 0)).toBe(1);
    expect(quantile(oneToTen, 1)).toBe(10);
  });

  it("handles a single value", () => {
    expect(quantile([42], 0.5)).toBe(42);
    expect(quantile([42], 0)).toBe(42);
  });

  it("refuses an empty sample rather than inventing a number", () => {
    expect(() => quantile([], 0.5)).toThrow(RangeError);
  });

  it("refuses a probability outside [0, 1]", () => {
    expect(() => quantile(oneToTen, 1.5)).toThrow(RangeError);
    expect(() => quantile(oneToTen, -0.1)).toThrow(RangeError);
  });

  it("never decreases as p rises", () => {
    let previous = -Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const value = quantile(oneToTen, p);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("trim", () => {
  it("drops both tails symmetrically", () => {
    const sample = [...Array.from({ length: 98 }, () => 50_000), 1, 10_000_000].sort(
      (a, b) => a - b,
    );
    const trimmed = trim(sample);
    expect(trimmed).not.toContain(1);
    expect(trimmed).not.toContain(10_000_000);
  });

  it("leaves a small sample alone", () => {
    // Below 20 values, cutting 2% each end removes a meaningful share of the
    // sample and does more damage than the outliers would.
    const small = [1, 2, 3, 1_000_000];
    expect(trim(small)).toEqual(small);
  });

  it("cannot be tuned to push a median in one direction", () => {
    const sample = Array.from({ length: 100 }, (_, i) => i + 1);
    const before = median(sample);
    const after = median(trim(sample));
    expect(Math.abs(after - before)).toBeLessThan(1);
  });
});

describe("summarise", () => {
  it("reports whole euro", () => {
    const summary = summarise([10_001, 20_002, 30_003, 40_004]);
    expect(Number.isInteger(summary.median)).toBe(true);
    expect(Number.isInteger(summary.p25)).toBe(true);
    expect(summary.n).toBe(4);
  });

  it("keeps the quartiles ordered around the median", () => {
    const sample = Array.from({ length: 200 }, (_, i) => (i + 1) * 500);
    const { p25, median: mid, p75 } = summarise(sample);
    expect(p25).toBeLessThan(mid);
    expect(mid).toBeLessThan(p75);
  });
});

describe("bins", () => {
  const sample = Array.from({ length: 500 }, (_, i) => 30_000 + i * 200).sort((a, b) => a - b);

  it("spans the data rather than a fixed axis", () => {
    // A fixed scale cannot hold both a Romanian junior and a Swiss principal
    // without one collapsing into a stub at the edge.
    const wide = bins(Array.from({ length: 500 }, (_, i) => 100_000 + i * 800));
    const narrow = bins(Array.from({ length: 500 }, (_, i) => 10_000 + i * 40));
    expect(wide.lo).toBeGreaterThan(narrow.hi);
  });

  it("produces the requested number of buckets", () => {
    expect(bins(sample, 36).bins).toHaveLength(36);
    expect(bins(sample, 12).bins).toHaveLength(12);
  });

  it("counts every value inside the bounds exactly once", () => {
    const shape = bins(sample);
    const counted = shape.bins.reduce((sum, b) => sum + b.count, 0);
    const inside = sample.filter((v) => v >= shape.lo && v <= shape.hi).length;
    expect(counted).toBe(inside);
  });

  it("returns an empty shape for an empty sample", () => {
    expect(bins([]).bins).toEqual([]);
  });
});
