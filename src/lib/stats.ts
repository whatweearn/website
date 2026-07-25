/**
 * Shapes the site renders from.
 *
 * These describe *real aggregates*. The design comp used a lognormal model to
 * fake a distribution; production never does that. A histogram here is bins
 * counted from actual responses, and every figure is nullable so the page has
 * a truthful way to say "not yet".
 *
 * Phase 3 replaces {@link getSiteStats} with a read of the nightly aggregation
 * output. Nothing else has to change.
 */

import { isCountryPublishable } from "./thresholds";

export type Bin = {
  /** Lower bound of the bucket, in euro. */
  lo: number;
  /** Upper bound, exclusive. */
  hi: number;
  count: number;
};

export type Distribution = {
  n: number;
  median: number;
  /** Axis bounds. Derived from the data, not fixed — see CLAUDE.md §7. */
  lo: number;
  hi: number;
  bins: Bin[];
};

export type CountryRow = {
  name: string;
  /** Local currency, shown as context beside euro-converted figures. */
  currency: string;
  responses: number;
  /** All null until the country clears the publication threshold. */
  median: number | null;
  p25: number | null;
  p75: number | null;
};

/**
 * One filtered view of the data.
 *
 * `country`/`level` are null for "everywhere"/"all levels", so the same shape
 * covers the headline figure and the narrowest slice.
 */
export type Cut = {
  country: string | null;
  level: string | null;
  /** Always present — how thin a slice is remains publishable information. */
  responses: number;
  /** Null when the cut has not cleared the publication threshold. */
  median: number | null;
  p25: number | null;
  p75: number | null;
  distribution: Distribution | null;
};

export type SiteStats = {
  totalResponses: number;
  countriesCovered: number;
  /** Null until there is enough data to draw anything honest. */
  europe: Distribution | null;
  countries: CountryRow[];
  /** Every filterable slice, keyed by `country|level` with `*` for "any". */
  cuts: Record<string, Cut>;
  /** Set once the downloadable dataset has been generated. */
  datasetRows?: number;
};

export function cutKey(country: string | null, level: string | null): string {
  return `${country ?? "*"}|${level ?? "*"}`;
}

export function findCut(
  stats: SiteStats,
  country: string | null,
  level: string | null,
): Cut | undefined {
  return stats.cuts[cutKey(country, level)];
}

/** True when we have nothing worth showing yet. */
export function isPreLaunch(stats: SiteStats): boolean {
  return stats.totalResponses === 0;
}

export function totalCount(d: Distribution): number {
  return d.bins.reduce((sum, bin) => sum + bin.count, 0);
}

/**
 * Where `value` sits in the distribution, 1–99.
 *
 * Interpolates within the containing bin rather than snapping to a bin edge,
 * so dragging the slider moves the readout smoothly instead of in steps.
 * Clamped away from 0 and 100 because neither is ever honest from a sample.
 */
export function percentileAt(d: Distribution, value: number): number {
  const total = totalCount(d);
  if (total === 0) return 1;

  let below = 0;
  for (const bin of d.bins) {
    if (value >= bin.hi) {
      below += bin.count;
      continue;
    }
    if (value > bin.lo) {
      below += bin.count * ((value - bin.lo) / (bin.hi - bin.lo));
    }
    break;
  }

  return Math.min(99, Math.max(1, Math.round((below / total) * 100)));
}

export function publishableCountries(stats: SiteStats): CountryRow[] {
  return stats.countries.filter((c) => isCountryPublishable(c.responses));
}

/** Where the nightly job writes its output, relative to the project root. */
export const STATS_FILE = "src/data/stats.json";

/**
 * What the site shows before a single response exists.
 *
 * Also what it shows if the aggregation has never run. Both cases must render
 * honestly rather than throwing or, worse, falling back to something invented.
 */
export const EMPTY_STATS: SiteStats = {
  totalResponses: 0,
  countriesCovered: 0,
  europe: null,
  countries: [],
  cuts: {},
};

/**
 * Current published aggregates.
 *
 * Reads the file produced by `pnpm aggregate`. Suppression was applied when
 * that file was written, so anything withheld is genuinely absent here — it
 * cannot be leaked by a rendering mistake, because it was never sent.
 */
export async function getSiteStats(): Promise<SiteStats> {
  const data = (await import("../data/stats.json")).default;
  return data as SiteStats;
}
