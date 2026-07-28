import { describe, expect, it } from "vitest";

import { STANDARD_BILLED_DAYS } from "../stats/dayRate";

import { COUNTRIES } from "./options";
import { APPROX_EUR_RATES, annualEuroApprox, checkSalary } from "./plausibility";

const verdict = (input: Parameters<typeof checkSalary>[0]) => checkSalary(input).verdict;

describe("the case that prompted this", () => {
  it("refuses 200 a year", () => {
    expect(verdict({ baseSalary: 200, salaryPeriod: "year", currency: "EUR" })).toBe("impossible");
  });

  it("accepts 200 a day, which is an ordinary contractor", () => {
    expect(
      verdict({ baseSalary: 200, salaryPeriod: "day", daysPerYear: 210, currency: "EUR" }),
    ).toBe("ok");
  });

  it("accepts 200 an hour, which is a well-paid one", () => {
    expect(
      verdict({ baseSalary: 200, salaryPeriod: "hour", hoursPerYear: 1_600, currency: "EUR" }),
    ).toBe("ok");
  });
});

describe("currency awareness", () => {
  it("accepts a normal Hungarian salary that a euro-scale threshold would reject", () => {
    // 12,000,000 HUF is roughly €30,000 — an ordinary Hungarian salary, and
    // the exact case a fixed numeric threshold gets wrong.
    expect(verdict({ baseSalary: 12_000_000, salaryPeriod: "year", currency: "HUF" })).toBe("ok");
  });

  it("rejects a forint figure that is only plausible as euro", () => {
    // 30,000 HUF a year is about €76. Under the old currency-blind check this
    // sailed through, because 30,000 "looks like" a salary.
    expect(verdict({ baseSalary: 30_000, salaryPeriod: "year", currency: "HUF" })).toBe(
      "impossible",
    );
  });

  it("treats the same number very differently across currencies", () => {
    expect(verdict({ baseSalary: 60_000, salaryPeriod: "year", currency: "EUR" })).toBe("ok");
    expect(verdict({ baseSalary: 60_000, salaryPeriod: "year", currency: "RSD" })).toBe(
      "impossible",
    );
  });

  it("accepts a normal Polish złoty salary", () => {
    expect(verdict({ baseSalary: 220_000, salaryPeriod: "year", currency: "PLN" })).toBe("ok");
  });
});

describe("period awareness", () => {
  it("catches a monthly figure entered as yearly", () => {
    // The single most common data-entry error this guards against.
    expect(verdict({ baseSalary: 3_500, salaryPeriod: "year", currency: "EUR" })).toBe("suspect");
  });

  it("accepts the same figure entered correctly as monthly", () => {
    expect(
      verdict({ baseSalary: 3_500, salaryPeriod: "month", paymentsPerYear: 14, currency: "EUR" }),
    ).toBe("ok");
  });
});

describe("bounds", () => {
  it("flags rather than refuses an unusually low salary", () => {
    // Junior pay in the lowest-cost markets here is genuinely this low. Losing
    // those responses would bias the dataset upward.
    expect(verdict({ baseSalary: 4_000, salaryPeriod: "year", currency: "EUR" })).toBe("suspect");
  });

  it("flags rather than refuses an unusually high one", () => {
    expect(verdict({ baseSalary: 600_000, salaryPeriod: "year", currency: "EUR" })).toBe("suspect");
  });

  it("refuses an extra digit", () => {
    expect(verdict({ baseSalary: 6_000_000, salaryPeriod: "year", currency: "EUR" })).toBe(
      "impossible",
    );
  });

  it("accepts the whole ordinary range without complaint", () => {
    for (const salary of [20_000, 45_000, 78_000, 120_000, 250_000]) {
      expect(verdict({ baseSalary: salary, salaryPeriod: "year", currency: "EUR" })).toBe("ok");
    }
  });
});

describe("messages", () => {
  it("names the likely cause rather than just refusing", () => {
    const check = checkSalary({ baseSalary: 200, salaryPeriod: "year", currency: "EUR" });
    expect(check.message).toMatch(/period/i);
  });

  it("tells someone with an unusual but real figure to send it anyway", () => {
    const check = checkSalary({ baseSalary: 4_000, salaryPeriod: "year", currency: "EUR" });
    expect(check.message).toMatch(/send it if it is right/i);
  });
});

describe("a rate given without its count", () => {
  /**
   * Contractors are no longer asked for their billed days, because their
   * published figure is a price derived at a standard year. That left the typo
   * defence switched off for them: with no multiplier there was nothing to
   * annualise, so every day rate was waved through however many digits it had.
   */
  it("still catches a typo in a day rate", () => {
    expect(verdict({ baseSalary: 650, salaryPeriod: "day", currency: "EUR" })).toBe("ok");
    expect(verdict({ baseSalary: 650_000, salaryPeriod: "day", currency: "EUR" })).toBe(
      "impossible",
    );
    expect(verdict({ baseSalary: 2, salaryPeriod: "day", currency: "EUR" })).toBe("impossible");
  });

  it("still catches a typo in an hourly rate", () => {
    expect(verdict({ baseSalary: 90, salaryPeriod: "hour", currency: "EUR" })).toBe("ok");
    expect(verdict({ baseSalary: 90_000, salaryPeriod: "hour", currency: "EUR" })).toBe(
      "impossible",
    );
  });

  it("uses their own count when they gave one", () => {
    // The check runs against the year they described, not the standard one.
    expect(annualEuroApprox({ baseSalary: 650, salaryPeriod: "day", currency: "EUR" })).toBe(
      650 * STANDARD_BILLED_DAYS,
    );
    expect(
      annualEuroApprox({ baseSalary: 650, salaryPeriod: "day", daysPerYear: 120, currency: "EUR" }),
    ).toBe(78_000);
  });

  it("stays silent when there is no standard to fall back on", () => {
    // 12, 13 and 14 payments are all normal, so a missing count is a question
    // about the answer rather than about the working year.
    expect(verdict({ baseSalary: 3_000, salaryPeriod: "month", currency: "EUR" })).toBe("ok");
  });

  it("stays silent on an unknown currency", () => {
    expect(verdict({ baseSalary: 60_000, salaryPeriod: "year", currency: "XYZ" })).toBe("ok");
  });
});

describe("rate table", () => {
  it("covers every currency the survey offers", () => {
    // A missing entry silently disables the check for that country.
    for (const country of COUNTRIES) {
      expect(APPROX_EUR_RATES[country.currency], `no rate for ${country.currency}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("converts in the direction the rates are quoted", () => {
    // Inverting this would make every złoty salary look eighteen times too big.
    expect(annualEuroApprox({ baseSalary: 43_000, salaryPeriod: "year", currency: "PLN" })).toBe(
      10_000,
    );
  });
});
