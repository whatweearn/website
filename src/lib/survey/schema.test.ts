import { describe, expect, it } from "vitest";

import { COUNTRIES, citiesFor } from "./options";
import {
  implausibilities,
  responseSchema,
  submissionSchema,
  submittableResponseSchema,
} from "./schema";

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

  /**
   * Architect is a track, not a rung, so nothing about it implies experience by
   * construction the way the ladder does. The check that catches a two-year
   * principal has to catch a two-year architect as well, or the parallel track
   * becomes the way round it.
   */
  it("flags a short career on either of the senior tracks", () => {
    for (const level of ["principal", "architect"] as const) {
      expect(
        implausibilities({ ...minimal, level, yearsExperience: 2 }),
        `${level} was not flagged`,
      ).toContain("senior_level_with_short_tenure");
    }
  });

  it("flags an annual figure that is too low to be one", () => {
    expect(implausibilities({ ...minimal, baseSalary: 2_500 })).toContain(
      "annual_pay_unusually_low",
    );
  });

  it("judges by converted value, not by the raw number", () => {
    // 12,000,000 forint is an ordinary Hungarian salary. The previous check
    // compared the raw number to a euro-scale threshold and got this wrong.
    expect(
      implausibilities({ ...minimal, baseSalary: 12_000_000, currency: "HUF" }),
    ).toEqual([]);
  });

  it("flags a bonus larger than three times base", () => {
    expect(implausibilities({ ...minimal, bonus: 300_000 })).toContain("bonus_exceeds_3x_base");
  });

  it("flags an unusual response without refusing it", () => {
    // Losing a real data point to protect against something the aggregation
    // already handles would be the wrong trade.
    const odd = { ...minimal, level: "junior" as const, yearsExperience: 30, baseSalary: 6_000 };
    expect(implausibilities(odd).length).toBeGreaterThan(0);
    expect(submittableResponseSchema.safeParse(odd).success).toBe(true);
  });

  it("refuses a figure that is impossible rather than merely unusual", () => {
    // €200 a year is a typo, not a salary, and it would drag a median.
    const typo = { ...minimal, baseSalary: 200 };
    expect(submittableResponseSchema.safeParse(typo).success).toBe(false);
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
