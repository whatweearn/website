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

import { POPULATION_UNIT, type Population, type Unit } from "./stats/populations";
import { isPublishable, untilPublish } from "./thresholds";

export {
  POPULATIONS,
  POPULATION_LABELS,
  POPULATION_UNIT,
  isPopulation,
  type Population,
  type Unit,
} from "./stats/populations";

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

/**
 * One country's figures, for one population.
 *
 * There is a row per population per country, never a row per country: an
 * employee median in euro a year and a contractor median in euro a day are
 * different quantities in different units, and the type says so rather than
 * leaving a caller to remember.
 */
export type CountryRow = {
  population: Population;
  code: string;
  name: string;
  /** Local currency, shown as context beside euro-converted figures. */
  currency: string;
  responses: number;
  /** All null until this population clears its threshold in this country. */
  median: number | null;
  p25: number | null;
  p75: number | null;
};

/**
 * One filtered view of the data.
 *
 * `country`/`level` are null for "everywhere"/"all levels", so the same shape
 * covers the Europe-wide figure and the narrowest slice. `population` is never
 * null: there is no view that averages across populations, because averaging
 * across them is the mistake the whole aggregation exists to avoid.
 */
export type Cut = {
  population: Population;
  country: string | null;
  level: string | null;
  /** Always present — how thin a slice is remains publishable information. */
  responses: number;
  /** In this population's unit. Null below its publication threshold. */
  median: number | null;
  p25: number | null;
  p75: number | null;
  distribution: Distribution | null;
};

export type SiteStats = {
  totalResponses: number;
  countriesCovered: number;
  /** One row per population per country. Filter with {@link countriesFor}. */
  countries: CountryRow[];
  /** Every slice, keyed by `population|country|level` with `*` for "any". */
  cuts: Record<string, Cut>;
  /** Set once the downloadable dataset has been generated. */
  datasetRows?: number;
};

export function cutKey(
  population: Population,
  country: string | null,
  level: string | null,
): string {
  return `${population}|${country ?? "*"}|${level ?? "*"}`;
}

export function findCut(
  stats: SiteStats,
  population: Population,
  country: string | null,
  level: string | null,
): Cut | undefined {
  return stats.cuts[cutKey(population, country, level)];
}

/** The unit a cut's figures are in, so nothing renders €700 a day as a salary. */
export function unitOf(cut: Pick<Cut, "population">): Unit {
  return POPULATION_UNIT[cut.population];
}

/** Country rows for one population, richest first. */
export function countriesFor(stats: SiteStats, population: Population): CountryRow[] {
  return stats.countries.filter((c) => c.population === population);
}

/** How many responses each population has, across everywhere. */
export function populationCounts(stats: SiteStats): Record<Population, number> {
  const counts = { employee: 0, part_time: 0, contractor: 0 };
  for (const row of stats.countries) counts[row.population] += row.responses;
  return counts;
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
  return stats.countries.some((c) => c.median !== null);
}

/**
 * The country and population pairs nearest to publishing, nearest first.
 *
 * Only pairs still short of their threshold: one that has published is no
 * longer something a visitor can help with.
 *
 * Measured as a *fraction* of the threshold rather than a raw count, because
 * the thresholds differ. Twenty contractor day rates in Poland are five short
 * of publishing while twenty employee salaries are forty short, and ranking
 * those two by count alone would put the far one first.
 */
export function countriesNearingPublication(
  stats: SiteStats,
  limit = 6,
): readonly CountryRow[] {
  return stats.countries
    .filter((c) => c.median === null && c.responses > 0)
    .sort(
      (a, b) =>
        progressTowardsPublishing(b) - progressTowardsPublishing(a) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

/** How far along its own threshold a row is, 0 to 1. */
export function progressTowardsPublishing(row: CountryRow): number {
  const remaining = untilPublish(row.population, row.responses);
  return row.responses / (row.responses + remaining);
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

export function publishableCountries(stats: SiteStats, population: Population): CountryRow[] {
  return countriesFor(stats, population).filter((c) => isPublishable(c.population, c.responses));
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
