import { TRIM_LOWER_PERCENTILE, TRIM_UPPER_PERCENTILE } from "../thresholds";

/**
 * Quantiles and trimming.
 *
 * Computed here rather than in SQL, deliberately. CLAUDE.md §7 requires
 * suppression and trimming to be enforced where they can be tested, not
 * trusted to a query that a later refactor might quietly change. At this
 * scale — thousands of rows, once a night — the cost is irrelevant.
 */

/**
 * Linear-interpolated quantile, matching Postgres `percentile_cont`.
 *
 * @param sorted Ascending. Not sorted here: callers sort once and take many
 *   quantiles, and re-sorting per call is how an O(n log n) job becomes slow.
 */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new RangeError("quantile of an empty sample");
  if (p < 0 || p > 1) throw new RangeError(`quantile p must be in [0, 1], received ${p}`);
  if (sorted.length === 1) return sorted[0]!;

  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;

  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function median(sorted: readonly number[]): number {
  return quantile(sorted, 0.5);
}

/**
 * Drops the extreme tails before publication.
 *
 * Trimming rather than winsorising: a fat-fingered €10,000,000 should leave
 * the sample, not be pulled to the 99th percentile and still drag the mean.
 * The rule is published, and it is symmetric so it cannot be tuned to push a
 * median in a preferred direction.
 *
 * Below ~20 values, trimming removes a meaningful share of a small sample and
 * does more harm than the outliers would, so it is skipped.
 */
export function trim(sorted: readonly number[]): number[] {
  if (sorted.length < 20) return [...sorted];

  const lo = quantile(sorted, TRIM_LOWER_PERCENTILE / 100);
  const hi = quantile(sorted, TRIM_UPPER_PERCENTILE / 100);
  return sorted.filter((value) => value >= lo && value <= hi);
}

export type Summary = {
  n: number;
  median: number;
  p25: number;
  p75: number;
};

/** Summarises an already-trimmed, ascending sample. */
export function summarise(sorted: readonly number[]): Summary {
  return {
    n: sorted.length,
    median: Math.round(median(sorted)),
    p25: Math.round(quantile(sorted, 0.25)),
    p75: Math.round(quantile(sorted, 0.75)),
  };
}

/**
 * Histogram bins spanning the 2nd to 98th percentile.
 *
 * Bounds follow the data rather than being fixed: a single axis cannot hold
 * both a Romanian junior and a Swiss principal without one of them collapsing
 * into a stub at the edge.
 */
export function bins(sorted: readonly number[], count = 36) {
  if (sorted.length === 0) return { lo: 0, hi: 0, bins: [] };

  const round = (v: number) => Math.round(v / 5_000) * 5_000;
  const lo = Math.max(0, round(quantile(sorted, 0.02)));
  const hi = round(quantile(sorted, 0.98));
  if (hi <= lo) return { lo, hi: lo + 5_000, bins: [] };

  const width = (hi - lo) / count;
  const buckets = Array.from({ length: count }, (_, i) => ({
    lo: lo + i * width,
    hi: lo + (i + 1) * width,
    count: 0,
  }));

  for (const value of sorted) {
    if (value < lo || value > hi) continue;
    const index = Math.min(count - 1, Math.floor((value - lo) / width));
    buckets[index]!.count += 1;
  }

  return { lo, hi, bins: buckets };
}
