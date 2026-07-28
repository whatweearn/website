import { describe, expect, it } from "vitest";

import { findCut } from "../stats";
import { COUNTRY_PUBLISH_MIN, DAY_RATE_PUBLISH_MIN, MIN_CELL_SIZE } from "../thresholds";

import { type AggregateRow, aggregate } from "./aggregate";
import { STANDARD_BILLED_DAYS } from "./dayRate";

const RATES = { EUR: 1, PLN: 4.3, CHF: 0.95, GBP: 0.84 };

function rows(count: number, overrides: Partial<AggregateRow> = {}): AggregateRow[] {
  return Array.from({ length: count }, (_, i) => ({
    country: "DE",
    level: "senior",
    contractType: "permanent",
    ftePercent: 100,
    baseSalary: 60_000 + i * 200,
    bonus: null,
    equityAnnual: null,
    currency: "EUR",
    ...overrides,
  }));
}

/** The row for one population in one country, by country name. */
function countryRow(
  stats: ReturnType<typeof aggregate>["stats"],
  name: string,
  population = "employee",
) {
  return stats.countries.find((c) => c.name === name && c.population === population);
}

describe("aggregate", () => {
  it("publishes nothing from an empty dataset", () => {
    const { stats } = aggregate([], RATES);
    expect(stats.totalResponses).toBe(0);
    expect(stats.countries).toEqual([]);
    expect(stats.cuts).toEqual({});
  });

  it("withholds a country's median until it clears the threshold", () => {
    const { stats } = aggregate(rows(COUNTRY_PUBLISH_MIN - 1), RATES);
    const germany = countryRow(stats, "Germany");
    expect(germany?.responses).toBe(COUNTRY_PUBLISH_MIN - 1);
    expect(germany?.median).toBeNull();
    expect(germany?.p25).toBeNull();
  });

  it("publishes once the threshold is reached", () => {
    const { stats } = aggregate(rows(COUNTRY_PUBLISH_MIN), RATES);
    const germany = countryRow(stats, "Germany");
    expect(germany?.median).toBeGreaterThan(0);
    expect(germany?.p25).toBeLessThan(germany!.median!);
  });

  it("never emits a suppressed figure, so it cannot leak through the UI", () => {
    // Suppression happens once, on the way out. A withheld value is absent
    // from the file rather than present-but-hidden.
    const { stats } = aggregate(rows(10), RATES);
    expect(JSON.stringify(stats)).toContain('"median":null');
  });

  it("converts foreign currencies rather than treating them as euro", () => {
    const polish = aggregate(rows(COUNTRY_PUBLISH_MIN, { country: "PL", currency: "PLN" }), RATES);
    const median = countryRow(polish.stats, "Poland")?.median ?? 0;
    // 60,000 PLN is roughly 14,000 EUR. Treating it as euro would put Polish
    // salaries about four times too high and nothing would look wrong.
    expect(median).toBeGreaterThan(13_000);
    expect(median).toBeLessThan(16_000);
  });

  it("reports rows it could not convert instead of dropping them silently", () => {
    const { skipped } = aggregate(rows(5, { currency: "XYZ" }), RATES);
    expect(skipped).toContainEqual({ reason: "missing_exchange_rate", count: 5 });
  });

  it("adds bonus and equity into total compensation", () => {
    const withExtras = aggregate(
      rows(COUNTRY_PUBLISH_MIN, { baseSalary: 60_000, bonus: 10_000, equityAnnual: 5_000 }),
      RATES,
    );
    expect(countryRow(withExtras.stats, "Germany")?.median).toBe(75_000);
  });

  it("empties any histogram bucket holding too few people to be anonymous", () => {
    // One outlier far from everyone else would otherwise sit alone in its own
    // bucket — a visible, identifiable individual.
    const sample = [...rows(200, { baseSalary: 60_000 }), ...rows(1, { baseSalary: 61_000 })];
    const { stats } = aggregate(sample, RATES);
    for (const bin of findCut(stats, "employee", null, null)?.distribution?.bins ?? []) {
      expect(bin.count === 0 || bin.count >= MIN_CELL_SIZE).toBe(true);
    }
  });

  it("orders countries by published median, unpublished last", () => {
    const { stats } = aggregate(
      [
        ...rows(COUNTRY_PUBLISH_MIN, { country: "DE", baseSalary: 70_000 }),
        ...rows(COUNTRY_PUBLISH_MIN, { country: "CH", baseSalary: 110_000, currency: "CHF" }),
        ...rows(5, { country: "PT" }),
      ],
      RATES,
    );
    const names = stats.countries.filter((c) => c.population === "employee").map((c) => c.name);
    expect(names[0]).toBe("Switzerland");
    expect(names[1]).toBe("Germany");
    expect(names.at(-1)).toBe("Portugal");
  });
});

/**
 * The change this file exists to protect.
 *
 * Every response reaches a published population now. Nothing is dropped for
 * being the wrong kind of worker, and no population's figures leak into
 * another's — those are two different assertions and both are made below.
 */
describe("populations", () => {
  it("skips nobody for the kind of contract they are on", () => {
    const mixed = [
      ...rows(3),
      ...rows(3, { contractType: "b2b", salaryPeriod: "year" }),
      ...rows(3, { ftePercent: 60 }),
    ];
    const { stats, skipped } = aggregate(mixed, RATES);

    expect(skipped).toEqual([]);
    expect(stats.totalResponses).toBe(9);
    for (const population of ["employee", "part_time", "contractor"] as const) {
      expect(countryRow(stats, "Germany", population)?.responses).toBe(3);
    }
  });

  it("keeps each population's answers out of the others' figures", () => {
    const { stats } = aggregate(
      [
        ...rows(COUNTRY_PUBLISH_MIN, { baseSalary: 60_000 }),
        ...rows(COUNTRY_PUBLISH_MIN, { baseSalary: 200_000, contractType: "b2b" }),
        ...rows(COUNTRY_PUBLISH_MIN, { baseSalary: 30_000, ftePercent: 50 }),
      ],
      RATES,
    );

    expect(countryRow(stats, "Germany", "employee")?.median).toBe(60_000);
    expect(countryRow(stats, "Germany", "part_time")?.median).toBe(30_000);
    // Not 200,000: a contractor is measured per day, at the standard year.
    expect(countryRow(stats, "Germany", "contractor")?.median).toBe(
      Math.round(200_000 / STANDARD_BILLED_DAYS),
    );
  });

  it("publishes a part-time salary as paid, never scaled to full time", () => {
    const { stats } = aggregate(
      rows(COUNTRY_PUBLISH_MIN, { baseSalary: 36_000, ftePercent: 60 }),
      RATES,
    );
    // 36,000 at 60% is not 60,000. Scaling would invent a salary nobody is
    // paid, which is the reason part-timers were excluded before rather than
    // a reason to exclude them.
    expect(countryRow(stats, "Germany", "part_time")?.median).toBe(36_000);
  });

  it("has no key that could hold a figure averaged across populations", () => {
    const { stats } = aggregate([...rows(3), ...rows(3, { contractType: "b2b" })], RATES);
    for (const key of Object.keys(stats.cuts)) {
      expect(key.split("|")[0]).toMatch(/^(employee|part_time|contractor)$/);
    }
  });
});

describe("contractor day rates", () => {
  const contractor = (over: Partial<AggregateRow> = {}): AggregateRow => ({
    country: "BE",
    level: "senior",
    contractType: "contractor",
    ftePercent: null,
    baseSalary: 700,
    salaryPeriod: "day",
    bonus: null,
    equityAnnual: null,
    currency: "EUR",
    ...over,
  });

  const rates = { EUR: 1, GBP: 0.85 };
  const many = (n: number, over: Partial<AggregateRow> = {}) =>
    Array.from({ length: n }, () => contractor(over));

  it("uses a quoted rate exactly as given", () => {
    const { stats } = aggregate(many(DAY_RATE_PUBLISH_MIN, { daysPerYear: 120 }), rates);
    // 700 a day stays 700 whether they billed 120 days or 250. The rate is a
    // price; how much of the year somebody worked is not a discount on it.
    expect(countryRow(stats, "Belgium", "contractor")?.median).toBe(700);
  });

  it("derives a rate from an annual figure at the standard year", () => {
    const { stats } = aggregate(
      many(DAY_RATE_PUBLISH_MIN, { salaryPeriod: "year", baseSalary: 154_000 }),
      rates,
    );
    expect(countryRow(stats, "Belgium", "contractor")?.median).toBe(700);
  });

  it("ignores bonus and equity, which are annual totals not prices", () => {
    const { stats } = aggregate(
      many(DAY_RATE_PUBLISH_MIN, { bonus: 50_000, equityAnnual: 20_000 }),
      rates,
    );
    expect(countryRow(stats, "Belgium", "contractor")?.median).toBe(700);
  });

  it("leaves an employee who quoted a day rate in the salary figures", () => {
    // An employee's day rate is not pricing the same thing, so it annualises
    // into total compensation rather than joining the contractor medians.
    const { stats } = aggregate(
      Array.from({ length: COUNTRY_PUBLISH_MIN }, () =>
        contractor({ contractType: "permanent", ftePercent: 100, daysPerYear: 220 }),
      ),
      rates,
    );
    expect(countryRow(stats, "Belgium", "contractor")).toBeUndefined();
    expect(countryRow(stats, "Belgium", "employee")?.median).toBe(154_000);
  });

  it("withholds the figures below the day-rate threshold but keeps the count", () => {
    const { stats } = aggregate(many(DAY_RATE_PUBLISH_MIN - 1), rates);
    const row = countryRow(stats, "Belgium", "contractor");
    expect(row?.responses).toBe(DAY_RATE_PUBLISH_MIN - 1);
    expect(row?.median).toBeNull();
  });

  it("converts to euro rather than comparing currencies directly", () => {
    const { stats } = aggregate(
      many(DAY_RATE_PUBLISH_MIN, { country: "UK", baseSalary: 850, currency: "GBP" }),
      rates,
    );
    expect(countryRow(stats, "United Kingdom", "contractor")?.median).toBe(1000);
  });

  it("reports a monthly figure it cannot convert instead of guessing the multiplier", () => {
    // Thirteen and fourteen payment years are normal in five countries, so a
    // missing count is not a licence to assume twelve.
    const { skipped } = aggregate(many(3, { salaryPeriod: "month", baseSalary: 12_000 }), rates);
    expect(skipped).toContainEqual({ reason: "missing_payments_per_year", count: 3 });
  });
});
