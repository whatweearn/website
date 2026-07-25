/**
 * Turns a quoted rate into an annual figure.
 *
 * People do not think about pay in one unit. An employee in Spain thinks in
 * monthly payments and knows there are fourteen of them; a French freelancer
 * thinks in a *taux journalier*; a Polish B2B contractor may think hourly.
 * Asking all of them for "gross annual" forces a conversion in their head on
 * the single most important screen in the survey, and they get it wrong or
 * give up.
 *
 * The conversion needs a multiplier, and the multiplier is the whole
 * difficulty: €600 a day is €120,000 over 200 billed days and €138,000 over
 * 230 — a 15% swing on a number we would be inventing. So it is asked for
 * rather than assumed, and where it is missing the response is excluded from
 * figures instead of being annualised on a guess.
 *
 * The counts are deliberately retrospective — "days you actually billed last
 * year", not "days you expect to bill" — matching the bonus question, which
 * asks what was paid rather than what was targeted.
 */

export type SalaryPeriod = "year" | "month" | "day" | "hour";

export type RateInput = {
  /** The amount as quoted, in the period below. */
  baseSalary: number;
  salaryPeriod?: SalaryPeriod | null;
  /** Monthly pay: 12, 13 or 14. Spain, Portugal, Italy, Austria and Greece. */
  paymentsPerYear?: number | null;
  /** Day rates: days actually billed last year. */
  daysPerYear?: number | null;
  /** Hourly rates: hours actually billed last year. */
  hoursPerYear?: number | null;
};

/** Bounds that reject nonsense without judging anyone's working year. */
export const LIMITS = {
  daysPerYear: { min: 1, max: 365 },
  hoursPerYear: { min: 1, max: 4000 },
} as const;

export type AnnualiseFailure =
  | "missing_days_per_year"
  | "missing_hours_per_year"
  | "missing_payments_per_year"
  | "implausible_multiplier";

export type AnnualiseResult =
  | { ok: true; annual: number }
  | { ok: false; reason: AnnualiseFailure };

/**
 * @returns The annual gross figure, or why it could not be computed.
 *
 * A missing period is treated as annual: that was the only option before this
 * existed, so historic rows and anyone who skips the selector keep the
 * behaviour they had.
 */
export function annualise(input: RateInput): AnnualiseResult {
  const period = input.salaryPeriod ?? "year";

  switch (period) {
    case "year":
      return { ok: true, annual: Math.round(input.baseSalary) };

    case "month": {
      const payments = input.paymentsPerYear;
      // Never defaulted to 12. In Spain or Portugal that would understate a
      // salary by a seventh, and the person would never know we had guessed.
      if (payments == null) return { ok: false, reason: "missing_payments_per_year" };
      if (payments < 12 || payments > 14) return { ok: false, reason: "implausible_multiplier" };
      return { ok: true, annual: Math.round(input.baseSalary * payments) };
    }

    case "day": {
      const days = input.daysPerYear;
      if (days == null) return { ok: false, reason: "missing_days_per_year" };
      if (days < LIMITS.daysPerYear.min || days > LIMITS.daysPerYear.max) {
        return { ok: false, reason: "implausible_multiplier" };
      }
      return { ok: true, annual: Math.round(input.baseSalary * days) };
    }

    case "hour": {
      const hours = input.hoursPerYear;
      if (hours == null) return { ok: false, reason: "missing_hours_per_year" };
      if (hours < LIMITS.hoursPerYear.min || hours > LIMITS.hoursPerYear.max) {
        return { ok: false, reason: "implausible_multiplier" };
      }
      return { ok: true, annual: Math.round(input.baseSalary * hours) };
    }
  }
}

/** Convenience for callers that treat "cannot annualise" as "skip this row". */
export function annualOrNull(input: RateInput): number | null {
  const result = annualise(input);
  return result.ok ? result.annual : null;
}
