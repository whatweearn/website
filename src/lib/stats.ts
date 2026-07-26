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
 * What contractors charge per day, in one country.
 *
 * A separate shape rather than another axis on {@link Cut}, because the unit is
 * different: these are euro *per day*, not euro per year. Sharing a keyspace
 * with annual figures would eventually let something render a €700 day rate as
 * a €700 salary, and nothing about the type would object.
 */
export type DayRateRow = {
  name: string;
  /** Day rates quoted, whether or not the figures below are published. */
  responses: number;
  /** Euro per day. Null until the country clears the day-rate threshold. */
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
  /**
   * Contractor day rates by country. Separate from `countries` because the
   * population and the unit are both different — see {@link DayRateRow}.
   *
   * Optional so a `stats.json` generated before this existed still loads
   * rather than failing the build. The aggregation always writes it.
   */
  dayRates?: DayRateRow[];
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

/**
 * Whether any figure has actually been published.
 *
 * The site promises the dataset opens the moment you submit. That is true once
 * something has cleared the threshold and false before it — and false for
 * exactly the first few hundred people, whose goodwill the project depends on.
 * Copy that makes the promise is gated on this.
 */
export function hasPublishedFigures(stats: SiteStats): boolean {
  return stats.europe !== null || stats.countries.some((c) => c.median !== null);
}

/**
 * The countries nearest to publishing, nearest first.
 *
 * Only countries still short of the threshold: one that has published is no
 * longer something a visitor can help with.
 *
 * The counts are the ones the aggregation puts in `CountryRow.responses`,
 * which are headline-eligible responses — employees on full-time standard
 * contracts. That is deliberate, because it is the population
 * {@link isCountryPublishable} is actually applied to. Counting every response
 * instead would promise a publication that the aggregation then declines to
 * make.
 */
export function countriesNearingPublication(
  stats: SiteStats,
  limit = 6,
): readonly CountryRow[] {
  return stats.countries
    .filter((c) => c.median === null && c.responses > 0)
    .sort((a, b) => b.responses - a.responses || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Countries with at least one quoted day rate, most rates first.
 *
 * Unlike {@link countriesNearingPublication} this keeps countries that have
 * already published: a contractor comparing rates wants the published ones
 * most of all.
 */
export function dayRatesByCountry(stats: SiteStats): readonly DayRateRow[] {
  return [...(stats.dayRates ?? [])].sort(
    (a, b) => b.responses - a.responses || a.name.localeCompare(b.name),
  );
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
  dayRates: [],
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
