import { describe, expect, it } from "vitest";

import { annualOrNull, annualise } from "./annualise";

function annual(input: Parameters<typeof annualise>[0]) {
  const result = annualise(input);
  return result.ok ? result.annual : null;
}

describe("annual figures", () => {
  it("passes an annual amount through untouched", () => {
    expect(annual({ baseSalary: 78_000, salaryPeriod: "year" })).toBe(78_000);
  });

  it("treats a missing period as annual", () => {
    // The only option before this existed. Historic rows and anyone who skips
    // the selector must keep the behaviour they had.
    expect(annual({ baseSalary: 78_000 })).toBe(78_000);
    expect(annual({ baseSalary: 78_000, salaryPeriod: null })).toBe(78_000);
  });
});

describe("monthly pay", () => {
  it("multiplies by the stated number of payments", () => {
    expect(annual({ baseSalary: 3_000, salaryPeriod: "month", paymentsPerYear: 12 })).toBe(36_000);
    expect(annual({ baseSalary: 3_000, salaryPeriod: "month", paymentsPerYear: 14 })).toBe(42_000);
  });

  it("refuses to guess twelve", () => {
    // Defaulting would understate a Spanish or Portuguese salary by a seventh,
    // and the person would never know we had guessed.
    expect(annualise({ baseSalary: 3_000, salaryPeriod: "month" })).toEqual({
      ok: false,
      reason: "missing_payments_per_year",
    });
  });

  it("rejects a payment count outside 12 to 14", () => {
    expect(annualise({ baseSalary: 3_000, salaryPeriod: "month", paymentsPerYear: 24 }).ok).toBe(
      false,
    );
  });

  it("captures the 17% difference the question exists for", () => {
    const twelve = annual({ baseSalary: 3_000, salaryPeriod: "month", paymentsPerYear: 12 })!;
    const fourteen = annual({ baseSalary: 3_000, salaryPeriod: "month", paymentsPerYear: 14 })!;
    expect(fourteen / twelve).toBeCloseTo(14 / 12, 5);
  });
});

describe("day rates", () => {
  it("multiplies by days actually billed", () => {
    expect(annual({ baseSalary: 600, salaryPeriod: "day", daysPerYear: 200 })).toBe(120_000);
  });

  it("refuses to invent a billable year", () => {
    // €600/day is €120,000 at 200 days and €138,000 at 230. Picking one
    // would be publishing a number nobody supplied.
    expect(annualise({ baseSalary: 600, salaryPeriod: "day" })).toEqual({
      ok: false,
      reason: "missing_days_per_year",
    });
  });

  it("rejects impossible day counts", () => {
    expect(annualise({ baseSalary: 600, salaryPeriod: "day", daysPerYear: 0 }).ok).toBe(false);
    expect(annualise({ baseSalary: 600, salaryPeriod: "day", daysPerYear: 400 }).ok).toBe(false);
  });

  it("accepts a part-year freelancer", () => {
    // Somebody who billed 40 days is not an error; they worked 40 days.
    expect(annual({ baseSalary: 700, salaryPeriod: "day", daysPerYear: 40 })).toBe(28_000);
  });
});

describe("hourly rates", () => {
  it("multiplies by hours actually billed", () => {
    expect(annual({ baseSalary: 75, salaryPeriod: "hour", hoursPerYear: 1_600 })).toBe(120_000);
  });

  it("refuses to invent a billable year", () => {
    expect(annualise({ baseSalary: 75, salaryPeriod: "hour" })).toEqual({
      ok: false,
      reason: "missing_hours_per_year",
    });
  });

  it("rejects an implausible number of hours", () => {
    // 4,000 hours is already 77 a week. Beyond that it is a typo.
    expect(annualise({ baseSalary: 75, salaryPeriod: "hour", hoursPerYear: 9_000 }).ok).toBe(false);
    expect(annualise({ baseSalary: 75, salaryPeriod: "hour", hoursPerYear: 0 }).ok).toBe(false);
  });
});

describe("agreement between ways of quoting the same pay", () => {
  it("lands on the same figure however it was entered", () => {
    const yearly = annual({ baseSalary: 120_000, salaryPeriod: "year" });
    const daily = annual({ baseSalary: 600, salaryPeriod: "day", daysPerYear: 200 });
    const hourly = annual({ baseSalary: 75, salaryPeriod: "hour", hoursPerYear: 1_600 });
    const monthly = annual({ baseSalary: 10_000, salaryPeriod: "month", paymentsPerYear: 12 });

    expect(daily).toBe(yearly);
    expect(hourly).toBe(yearly);
    expect(monthly).toBe(yearly);
  });
});

describe("annualOrNull", () => {
  it("gives a number when it can and null when it cannot", () => {
    expect(annualOrNull({ baseSalary: 600, salaryPeriod: "day", daysPerYear: 210 })).toBe(126_000);
    expect(annualOrNull({ baseSalary: 600, salaryPeriod: "day" })).toBeNull();
  });
});
