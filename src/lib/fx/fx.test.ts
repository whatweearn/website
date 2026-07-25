import { describe, expect, it } from "vitest";

import { MissingRateError, toEuro, totalCompEuro } from "./convert";
import { parseEcbDaily } from "./ecb";

const RATES = { EUR: 1, PLN: 4.3, CHF: 0.95 };

describe("toEuro", () => {
  it("leaves euro untouched", () => {
    expect(toEuro(60_000, "EUR", RATES)).toBe(60_000);
  });

  it("divides by units-per-euro, the direction the ECB quotes", () => {
    // Getting this inverted would multiply Polish salaries by 18 instead of
    // dividing by 4.3, and the result would still look like a number.
    expect(toEuro(43_000, "PLN", RATES)).toBeCloseTo(10_000, 6);
  });

  it("throws on an unknown currency rather than assuming parity", () => {
    expect(() => toEuro(1_000, "XYZ", RATES)).toThrow(MissingRateError);
  });

  it("throws on a nonsensical rate", () => {
    expect(() => toEuro(1_000, "BAD", { ...RATES, BAD: 0 })).toThrow(MissingRateError);
  });
});

describe("totalCompEuro", () => {
  it("sums base, bonus and equity", () => {
    expect(
      totalCompEuro(
        { baseSalary: 60_000, bonus: 8_000, equityAnnual: 12_000, currency: "EUR" },
        RATES,
      ),
    ).toBe(80_000);
  });

  it("treats absent bonus and equity as zero, not as missing data", () => {
    expect(totalCompEuro({ baseSalary: 60_000, currency: "EUR" }, RATES)).toBe(60_000);
    expect(
      totalCompEuro({ baseSalary: 60_000, bonus: null, equityAnnual: null, currency: "EUR" }, RATES),
    ).toBe(60_000);
  });

  it("does not multiply by payments per year", () => {
    // The entered base is already annual. Multiplying by 14 would inflate
    // every Spanish and Portuguese salary by 17%.
    const spanish = totalCompEuro({ baseSalary: 42_000, currency: "EUR" }, RATES);
    expect(spanish).toBe(42_000);
  });
});

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01">
  <Cube>
    <Cube time='2026-07-24'>
      <Cube currency='USD' rate='1.0821'/>
      <Cube currency='GBP' rate='0.84230'/>
      <Cube currency='PLN' rate='4.2795'/>
      <Cube currency='CHF' rate='0.9512'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe("parseEcbDaily", () => {
  it("reads the reference date and every rate", () => {
    const { date, rates } = parseEcbDaily(SAMPLE_FEED);
    expect(date).toBe("2026-07-24");
    expect(rates.PLN).toBeCloseTo(4.2795, 6);
    expect(rates.GBP).toBeCloseTo(0.8423, 6);
  });

  it("adds EUR, which the feed omits because everything is quoted against it", () => {
    expect(parseEcbDaily(SAMPLE_FEED).rates.EUR).toBe(1);
  });

  it("throws when the feed has no rates rather than returning an empty table", () => {
    // An empty table would make every conversion throw later, far from the
    // cause. Failing here names the problem.
    expect(() => parseEcbDaily("<Cube time='2026-07-24'></Cube>")).toThrow(/no rates/);
  });

  it("throws when the feed has no date", () => {
    expect(() => parseEcbDaily("<nonsense/>")).toThrow(/reference date/);
  });

  it("handles double-quoted attributes as well as single", () => {
    const doubled = SAMPLE_FEED.replace(/'/g, '"');
    expect(parseEcbDaily(doubled).rates.USD).toBeCloseTo(1.0821, 6);
  });
});
