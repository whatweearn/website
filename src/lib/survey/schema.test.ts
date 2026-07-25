import { describe, expect, it } from "vitest";

import { COUNTRIES, citiesFor } from "./options";
import { implausibilities, responseSchema, submissionSchema } from "./schema";

const minimal = {
  country: "DE",
  contractType: "permanent",
  level: "senior",
  baseSalary: 78_000,
  currency: "EUR",
} as const;

describe("responseSchema", () => {
  it("accepts the four required answers alone", () => {
    expect(responseSchema.safeParse(minimal).success).toBe(true);
  });

  it.each(["country", "contractType", "level", "baseSalary"] as const)(
    "refuses a response missing %s",
    (field) => {
      const rest = Object.fromEntries(
        Object.entries(minimal).filter(([key]) => key !== field),
      );
      expect(responseSchema.safeParse(rest).success).toBe(false);
    },
  );

  it("rejects a negative salary", () => {
    expect(responseSchema.safeParse({ ...minimal, baseSalary: -1 }).success).toBe(false);
  });

  it("rejects an unknown country rather than storing it", () => {
    expect(responseSchema.safeParse({ ...minimal, country: "XX" }).success).toBe(false);
  });

  it("rejects a payment count outside 12, 13 or 14", () => {
    expect(responseSchema.safeParse({ ...minimal, paymentsPerYear: 11 }).success).toBe(false);
    expect(responseSchema.safeParse({ ...minimal, paymentsPerYear: 14 }).success).toBe(true);
  });

  it("strips anything it was not asked for", () => {
    const parsed = responseSchema.parse({ ...minimal, employer: "Acme GmbH", note: "hi" });
    // The promise is that no free text can reach the dataset by accident.
    expect(parsed).not.toHaveProperty("employer");
    expect(parsed).not.toHaveProperty("note");
  });
});

describe("submissionSchema", () => {
  const envelope = { response: minimal, formToken: "1.sig" };

  it("accepts a well-formed submission", () => {
    expect(submissionSchema.safeParse(envelope).success).toBe(true);
  });

  it("requires a form token", () => {
    expect(submissionSchema.safeParse({ response: minimal }).success).toBe(false);
  });

  it("refuses a filled honeypot", () => {
    expect(submissionSchema.safeParse({ ...envelope, website: "http://spam" }).success).toBe(
      false,
    );
  });

  it("allows an empty honeypot, which is what a real browser sends", () => {
    expect(submissionSchema.safeParse({ ...envelope, website: "" }).success).toBe(true);
  });
});

describe("implausibilities", () => {
  it("passes an ordinary response with no flags", () => {
    expect(implausibilities({ ...minimal, yearsExperience: 8 })).toEqual([]);
  });

  it("flags a junior with a long career", () => {
    expect(implausibilities({ ...minimal, level: "junior", yearsExperience: 18 })).toContain(
      "junior_with_long_tenure",
    );
  });

  it("flags a base salary that looks like a monthly figure", () => {
    expect(implausibilities({ ...minimal, baseSalary: 2_500 })).toContain(
      "base_salary_looks_monthly",
    );
  });

  it("flags a bonus larger than three times base", () => {
    expect(implausibilities({ ...minimal, bonus: 300_000 })).toContain("bonus_exceeds_3x_base");
  });

  it("only flags — it never rejects", () => {
    // Losing a real data point to protect against something the aggregation
    // layer already handles would be the wrong trade.
    const odd = { ...minimal, level: "junior" as const, yearsExperience: 30, baseSalary: 1_000 };
    expect(implausibilities(odd).length).toBeGreaterThan(0);
    expect(responseSchema.safeParse(odd).success).toBe(true);
  });
});

describe("options", () => {
  it("gives every country a currency", () => {
    for (const country of COUNTRIES) {
      expect(country.currency).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("always offers an escape hatch in the city list", () => {
    // Otherwise someone outside the listed hubs cannot answer honestly.
    for (const country of COUNTRIES) {
      expect(citiesFor(country.code)).toContain("Elsewhere");
    }
  });
});
