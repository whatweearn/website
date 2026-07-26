import { describe, expect, it } from "vitest";

import { COUNTRY_PUBLISH_MIN, MIN_CELL_SIZE } from "../thresholds";

import { DAY_RATE_PUBLISH_MIN } from "../thresholds";
import { type AggregateRow, aggregate, isHeadlineEligible } from "./aggregate";

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

describe("headline eligibility", () => {
  it("includes employees on standard contracts", () => {
    expect(isHeadlineEligible(rows(1)[0]!)).toBe(true);
    expect(isHeadlineEligible(rows(1, { contractType: "fixed_term" })[0]!)).toBe(true);
  });

  it("excludes B2B and freelance from headline figures", () => {
    // Their gross carries the worker's social contributions, so averaging it
    // with employed gross produces a number describing nobody. This is the
    // single most distorting mistake available in European pay data.
    expect(isHeadlineEligible(rows(1, { contractType: "b2b" })[0]!)).toBe(false);
    expect(isHeadlineEligible(rows(1, { contractType: "contractor" })[0]!)).toBe(false);
  });

  it("excludes part-timers rather than extrapolating them", () => {
    // Scaling a 60% contract to full time invents a salary nobody is paid.
    expect(isHeadlineEligible(rows(1, { ftePercent: 60 })[0]!)).toBe(false);
    expect(isHeadlineEligible(rows(1, { ftePercent: null })[0]!)).toBe(true);
  });
});

describe("aggregate", () => {
  it("publishes nothing from an empty dataset", () => {
    const { stats } = aggregate([], RATES);
    expect(stats.totalResponses).toBe(0);
    expect(stats.europe).toBeNull();
    expect(stats.countries).toEqual([]);
  });

  it("withholds a country's median until it clears the threshold", () => {
    const { stats } = aggregate(rows(COUNTRY_PUBLISH_MIN - 1), RATES);
    const germany = stats.countries.find((c) => c.name === "Germany");
    expect(germany?.responses).toBe(COUNTRY_PUBLISH_MIN - 1);
    expect(germany?.median).toBeNull();
    expect(germany?.p25).toBeNull();
  });

  it("publishes once the threshold is reached", () => {
    const { stats } = aggregate(rows(COUNTRY_PUBLISH_MIN), RATES);
    const germany = stats.countries.find((c) => c.name === "Germany");
    expect(germany?.median).toBeGreaterThan(0);
    expect(germany?.p25).toBeLessThan(germany!.median!);
  });

  it("never emits a suppressed figure, so it cannot leak through the UI", () => {
    // Suppression happens once, on the way out. A withheld value is absent
    // from the file rather than present-but-hidden.
    const { stats } = aggregate(rows(10), RATES);
    const serialised = JSON.stringify(stats);
    expect(serialised).toContain('"median":null');
  });

  it("converts foreign currencies rather than treating them as euro", () => {
    const polish = aggregate(rows(COUNTRY_PUBLISH_MIN, { country: "PL", currency: "PLN" }), RATES);
    const median = polish.stats.countries.find((c) => c.name === "Poland")?.median ?? 0;
    // 60,000 PLN is roughly 14,000 EUR. Treating it as euro would put Polish
    // salaries about four times too high and nothing would look wrong.
    expect(median).toBeGreaterThan(13_000);
    expect(median).toBeLessThan(16_000);
  });

  it("reports rows it could not convert instead of dropping them silently", () => {
    const { skipped } = aggregate(rows(5, { currency: "XYZ" }), RATES);
    expect(skipped).toContainEqual({ reason: "missing_exchange_rate", count: 5 });
  });

  it("counts every response but bases figures only on eligible ones", () => {
    const mixed = [...rows(COUNTRY_PUBLISH_MIN), ...rows(40, { contractType: "b2b" })];
    const { stats, skipped } = aggregate(mixed, RATES);

    expect(stats.totalResponses).toBe(mixed.length);
    expect(skipped).toContainEqual({ reason: "non_employee_contract", count: 40 });
    expect(stats.countries.find((c) => c.name === "Germany")?.responses).toBe(
      COUNTRY_PUBLISH_MIN,
    );
  });

  it("adds bonus and equity into total compensation", () => {
    const withExtras = aggregate(
      rows(COUNTRY_PUBLISH_MIN, { baseSalary: 60_000, bonus: 10_000, equityAnnual: 5_000 }),
      RATES,
    );
    const median = withExtras.stats.countries.find((c) => c.name === "Germany")?.median ?? 0;
    expect(median).toBe(75_000);
  });

  it("empties any histogram bucket holding too few people to be anonymous", () => {
    // One outlier far from everyone else would otherwise sit alone in its own
    // bucket — a visible, identifiable individual.
    const sample = [...rows(200, { baseSalary: 60_000 }), ...rows(1, { baseSalary: 61_000 })];
    const { stats } = aggregate(sample, RATES);
    for (const bin of stats.europe?.bins ?? []) {
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
    const names = stats.countries.map((c) => c.name);
    expect(names[0]).toBe("Switzerland");
    expect(names[1]).toBe("Germany");
    expect(names.at(-1)).toBe("Portugal");
  });
});

describe("contractor day rates", () => {
  const dayRate = (over: Partial<AggregateRow> = {}): AggregateRow => ({
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

  it("reports the quoted rate, never an annualised one", () => {
    // The whole point: 700/day stays 700, it does not become 700 × billed days.
    const { stats } = aggregate([dayRate({ daysPerYear: 220 })], rates);
    expect(stats.dayRates?.[0]?.responses).toBe(1);
  });

  it("ignores bonus and equity, which are annual totals not prices", () => {
    const withExtras = Array.from({ length: DAY_RATE_PUBLISH_MIN }, () =>
      dayRate({ bonus: 50_000, equityAnnual: 20_000 }),
    );
    const { stats } = aggregate(withExtras, rates);
    expect(stats.dayRates?.[0]?.median).toBe(700);
  });

  it("excludes employees, whose day rate is not pricing the same thing", () => {
    const { stats } = aggregate([dayRate({ contractType: "permanent" })], rates);
    expect(stats.dayRates ?? []).toHaveLength(0);
  });

  it("excludes contractors who quoted anything other than a day rate", () => {
    const rows = [
      dayRate({ salaryPeriod: "year", baseSalary: 150_000 }),
      dayRate({ salaryPeriod: "hour", baseSalary: 90, hoursPerYear: 1600 }),
      dayRate({ salaryPeriod: null }),
    ];
    const { stats } = aggregate(rows, rates);
    expect(stats.dayRates ?? []).toHaveLength(0);
  });

  it("withholds the figures below the day-rate threshold but keeps the count", () => {
    const rows = Array.from({ length: DAY_RATE_PUBLISH_MIN - 1 }, () => dayRate());
    const { stats } = aggregate(rows, rates);
    expect(stats.dayRates?.[0]?.responses).toBe(DAY_RATE_PUBLISH_MIN - 1);
    expect(stats.dayRates?.[0]?.median).toBeNull();
  });

  it("publishes once the threshold is reached", () => {
    const rows = Array.from({ length: DAY_RATE_PUBLISH_MIN }, (_, i) =>
      dayRate({ baseSalary: 600 + i * 10 }),
    );
    const { stats } = aggregate(rows, rates);
    expect(stats.dayRates?.[0]?.median).toBeGreaterThan(600);
    expect(stats.dayRates?.[0]?.p25).toBeLessThan(stats.dayRates![0]!.median!);
  });

  it("converts to euro rather than comparing currencies directly", () => {
    const rows = Array.from({ length: DAY_RATE_PUBLISH_MIN }, () =>
      dayRate({ country: "UK", baseSalary: 850, currency: "GBP" }),
    );
    const { stats } = aggregate(rows, rates);
    expect(stats.dayRates?.[0]?.median).toBe(1000);
  });

  it("does not let day rates reach the salary medians", () => {
    // The salary side must be untouched by any of this.
    const { stats } = aggregate(
      Array.from({ length: DAY_RATE_PUBLISH_MIN }, () => dayRate()),
      rates,
    );
    expect(stats.countries).toHaveLength(0);
    expect(stats.europe).toBeNull();
  });
});
