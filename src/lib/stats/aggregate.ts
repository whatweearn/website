import { type RateInput, annualise } from "../survey/annualise";
import { COUNTRIES } from "../survey/options";
import { COUNTRY_PUBLISH_MIN, MIN_CELL_SIZE } from "../thresholds";
import { type RateTable, totalCompEuro } from "../fx/convert";
import {
  type CountryRow,
  type Cut,
  type Distribution,
  type SiteStats,
  cutKey,
} from "../stats";

import { isEmployeeContract, isHeadlineEligible } from "./eligibility";
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

// The rule itself lives in ./eligibility, because the live count in
// `countForCountry` has to apply the same one in SQL. Re-exported so callers
// and tests keep importing it from here.
export { isHeadlineEligible } from "./eligibility";

const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c] as const));

export type AggregateResult = {
  stats: SiteStats;
  /** Rows dropped before any figure was computed, and why. */
  skipped: { reason: string; count: number }[];
};

/**
 * Turns raw responses into exactly what the site is allowed to publish.
 *
 * Suppression happens here, once, on the way out — not in a query and not in
 * the UI. A cut that does not clear the threshold is never written to the
 * output file at all, so it cannot be leaked by a later rendering bug.
 */
export function aggregate(rows: readonly AggregateRow[], rates: RateTable): AggregateResult {
  const skipped = new Map<string, number>();
  const bump = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);

  const eligible: { country: string; level: string; total: number }[] = [];

  for (const row of rows) {
    if (!isHeadlineEligible(row)) {
      bump(isEmployeeContract(row.contractType) ? "part_time" : "non_employee_contract");
      continue;
    }
    // A rate quoted per day or hour without its count cannot be annualised,
    // and guessing the multiplier would publish a number nobody supplied.
    const annual = annualise(row);
    if (!annual.ok) {
      bump(annual.reason);
      continue;
    }

    try {
      eligible.push({
        country: row.country,
        level: row.level,
        total: totalCompEuro({ ...row, annualBase: annual.annual }, rates),
      });
    } catch {
      bump("missing_exchange_rate");
    }
  }

  const byCountry = new Map<string, number[]>();
  for (const { country, total } of eligible) {
    const list = byCountry.get(country);
    if (list) list.push(total);
    else byCountry.set(country, [total]);
  }

  const countries: CountryRow[] = [];
  for (const [code, values] of byCountry) {
    const meta = COUNTRY_NAMES.get(code as never);
    if (!meta) {
      bump("unknown_country");
      continue;
    }

    const responses = values.length;
    const publishable = responses >= COUNTRY_PUBLISH_MIN;
    const summary = publishable ? summarise(trim([...values].sort((a, b) => a - b))) : null;

    countries.push({
      name: meta.name,
      currency: meta.currency,
      responses,
      median: summary?.median ?? null,
      p25: summary?.p25 ?? null,
      p75: summary?.p75 ?? null,
    });
  }

  countries.sort((a, b) => (b.median ?? -1) - (a.median ?? -1) || b.responses - a.responses);

  const allValues = eligible.map((e) => e.total).sort((a, b) => a - b);
  const europe = distributionOf(allValues);

  return {
    stats: {
      totalResponses: rows.length,
      countriesCovered: byCountry.size,
      europe,
      countries,
      cuts: buildCuts(eligible),
    },
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
  };
}

/**
 * Every country/level slice, including the "any" margins.
 *
 * Thin cuts are still listed with their response count — that a slice is thin
 * is itself worth telling someone, and it is what turns "no data" into "help
 * make this one publishable". Only the figures are withheld.
 */
function buildCuts(
  eligible: readonly { country: string; level: string; total: number }[],
): Record<string, Cut> {
  const groups = new Map<string, { country: string | null; level: string | null; values: number[] }>();

  const add = (country: string | null, level: string | null, total: number) => {
    const key = cutKey(country, level);
    const group = groups.get(key);
    if (group) group.values.push(total);
    else groups.set(key, { country, level, values: [total] });
  };

  for (const { country, level, total } of eligible) {
    add(country, level, total);
    add(country, null, total);
    add(null, level, total);
    add(null, null, total);
  }

  const cuts: Record<string, Cut> = {};
  for (const [key, { country, level, values }] of groups) {
    const responses = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const publishable = responses >= COUNTRY_PUBLISH_MIN;
    const summary = publishable ? summarise(trim(sorted)) : null;

    cuts[key] = {
      country,
      level,
      responses,
      median: summary?.median ?? null,
      p25: summary?.p25 ?? null,
      p75: summary?.p75 ?? null,
      distribution: distributionOf(sorted),
    };
  }
  return cuts;
}

/**
 * A publishable distribution, or null.
 *
 * Returns null below the cell threshold rather than an empty shape, so there
 * is no half-populated object for a caller to render by mistake.
 */
function distributionOf(sorted: readonly number[]): Distribution | null {
  if (sorted.length < COUNTRY_PUBLISH_MIN) return null;

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
