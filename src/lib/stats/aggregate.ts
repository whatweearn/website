import { type RateInput, annualise } from "../survey/annualise";
import { COUNTRIES } from "../survey/options";
import { MIN_CELL_SIZE, isPublishable, publishMinFor } from "../thresholds";
import { type RateTable, toEuro, totalCompEuro } from "../fx/convert";
import { type CountryRow, type Cut, type Distribution, type SiteStats, cutKey } from "../stats";

import { dayRateOf } from "./dayRate";
import { POPULATIONS, type Population, populationOf } from "./populations";
import { bins, summarise, trim } from "./quantiles";

export type AggregateRow = RateInput & {
  country: string;
  level: string;
  contractType: string;
  ftePercent: number | null;
  bonus: number | null;
  equityAnnual: number | null;
  currency: string;
};

// The rule itself lives in ./populations, because the live counts behind the
// confirmation screen have to apply the same one in SQL.
export { populationOf } from "./populations";

const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c] as const));

export type AggregateResult = {
  stats: SiteStats;
  /** Rows dropped before any figure was computed, and why. */
  skipped: { reason: string; count: number }[];
};

/** One response, reduced to the figure its population is measured in. */
type Measured = { population: Population; country: string; level: string; value: number };

/**
 * Turns raw responses into exactly what the site is allowed to publish.
 *
 * Suppression happens here, once, on the way out — not in a query and not in
 * the UI. A cut that does not clear its population's threshold is never
 * written to the output file at all, so it cannot be leaked by a later
 * rendering bug.
 *
 * Nothing is dropped for being the wrong kind of worker any more. A response
 * is skipped only when its own figure cannot be computed — a missing
 * multiplier, or a currency with no exchange rate for the day. Which
 * population it lands in decides what it is measured in, never whether it is
 * measured at all.
 */
export function aggregate(rows: readonly AggregateRow[], rates: RateTable): AggregateResult {
  const skipped = new Map<string, number>();
  const bump = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);

  const measured: Measured[] = [];

  for (const row of rows) {
    const population = populationOf(row);
    const value =
      population === "contractor" ? contractorDayRate(row, rates, bump) : employeeTotal(row, rates, bump);
    if (value === null) continue;
    measured.push({ population, country: row.country, level: row.level, value });
  }

  const countries: CountryRow[] = [];
  const covered = new Set<string>();

  for (const population of POPULATIONS) {
    const byCountry = new Map<string, number[]>();
    for (const m of measured) {
      if (m.population !== population) continue;
      covered.add(m.country);
      const list = byCountry.get(m.country);
      if (list) list.push(m.value);
      else byCountry.set(m.country, [m.value]);
    }

    for (const [code, values] of byCountry) {
      const meta = COUNTRY_NAMES.get(code as never);
      if (!meta) {
        bump("unknown_country");
        continue;
      }

      const responses = values.length;
      const summary = isPublishable(population, responses)
        ? summarise(trim([...values].sort((a, b) => a - b)))
        : null;

      countries.push({
        population,
        code,
        name: meta.name,
        currency: meta.currency,
        responses,
        median: summary?.median ?? null,
        p25: summary?.p25 ?? null,
        p75: summary?.p75 ?? null,
      });
    }
  }

  countries.sort(
    (a, b) =>
      POPULATIONS.indexOf(a.population) - POPULATIONS.indexOf(b.population) ||
      (b.median ?? -1) - (a.median ?? -1) ||
      b.responses - a.responses,
  );

  return {
    stats: {
      totalResponses: rows.length,
      countriesCovered: covered.size,
      countries,
      cuts: buildCuts(measured),
    },
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
  };
}

/** Annual total compensation in euro, or null with the reason recorded. */
function employeeTotal(
  row: AggregateRow,
  rates: RateTable,
  bump: (reason: string) => void,
): number | null {
  // A rate quoted per day or hour without its count cannot be annualised, and
  // guessing the multiplier would publish a number nobody supplied. Note that
  // a part-time salary is annualised exactly as given: the FTE fraction is
  // never scaled away, because scaling is what would invent the figure.
  const annual = annualise(row);
  if (!annual.ok) {
    bump(annual.reason);
    return null;
  }
  try {
    return totalCompEuro({ ...row, annualBase: annual.annual }, rates);
  } catch {
    bump("missing_exchange_rate");
    return null;
  }
}

/**
 * Euro per day, however the rate was quoted.
 *
 * Base pay only, and derived against a standard working year rather than the
 * days this person happened to bill — see ./dayRate for why that is the
 * difference between publishing a price and publishing a work rate.
 */
function contractorDayRate(
  row: AggregateRow,
  rates: RateTable,
  bump: (reason: string) => void,
): number | null {
  const rate = dayRateOf(row);
  if (!rate.ok) {
    bump(rate.reason);
    return null;
  }
  try {
    return Math.round(toEuro(rate.perDay, row.currency, rates));
  } catch {
    bump("missing_exchange_rate");
    return null;
  }
}

/**
 * Every population/country/level slice, including the "any" margins.
 *
 * Thin cuts are still listed with their response count — that a slice is thin
 * is itself worth telling someone, and it is what turns "no data" into "help
 * make this one publishable". Only the figures are withheld.
 *
 * Population is never an "any" margin. Averaging across populations is the one
 * thing this whole module exists to prevent, so there is no key that would
 * even hold the result.
 */
function buildCuts(measured: readonly Measured[]): Record<string, Cut> {
  const groups = new Map<
    string,
    { population: Population; country: string | null; level: string | null; values: number[] }
  >();

  const add = (population: Population, country: string | null, level: string | null, value: number) => {
    const key = cutKey(population, country, level);
    const group = groups.get(key);
    if (group) group.values.push(value);
    else groups.set(key, { population, country, level, values: [value] });
  };

  for (const { population, country, level, value } of measured) {
    add(population, country, level, value);
    add(population, country, null, value);
    add(population, null, level, value);
    add(population, null, null, value);
  }

  const cuts: Record<string, Cut> = {};
  for (const [key, { population, country, level, values }] of groups) {
    const responses = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const summary = isPublishable(population, responses) ? summarise(trim(sorted)) : null;

    cuts[key] = {
      population,
      country,
      level,
      responses,
      median: summary?.median ?? null,
      p25: summary?.p25 ?? null,
      p75: summary?.p75 ?? null,
      distribution: distributionOf(population, sorted),
    };
  }
  return cuts;
}

/**
 * A publishable distribution, or null.
 *
 * Returns null below the population's threshold rather than an empty shape, so
 * there is no half-populated object for a caller to render by mistake.
 */
function distributionOf(population: Population, sorted: readonly number[]): Distribution | null {
  if (sorted.length < publishMinFor(population)) return null;

  const trimmed = trim(sorted);
  const shape = bins(trimmed);
  if (shape.bins.length === 0) return null;

  // Any bucket holding fewer than the minimum would describe an identifiable
  // handful of people, so it is emptied rather than published.
  const suppressed = shape.bins.map((bin) =>
    bin.count > 0 && bin.count < MIN_CELL_SIZE ? { ...bin, count: 0 } : bin,
  );

  return {
    n: trimmed.length,
    median: summarise(trimmed).median,
    lo: shape.lo,
    hi: shape.hi,
    bins: suppressed,
  };
}
