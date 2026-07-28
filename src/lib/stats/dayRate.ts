import type { RateInput } from "../survey/annualise";

/**
 * What a contractor charges, per day.
 *
 * A day rate is the number that means something for self-employed work. It is
 * a single negotiated price with no bonus, no equity, no thirteenth month and
 * no part-time fraction in it, and unlike an annual figure it does not change
 * with how much of the year someone chose to work.
 *
 * That last point decides the conversion. A contractor who quotes a day rate
 * gives us the price directly. A contractor who quotes annual income gives us
 * price × how much they worked, so recovering the price means dividing by a
 * **standard** year rather than by the days they personally billed. Taking six
 * weeks off does not make someone cheaper, and a median built on actual billed
 * days would say it did — it would measure holidays, parental leave and dry
 * spells as if they were discounts.
 *
 * The standards below are therefore deliberately fixed and deliberately
 * published. They are stated on the methodology page, and because the raw
 * amount and its period are what we store, anyone who disagrees can recompute
 * the whole thing from the dataset with different ones.
 */

/**
 * The working year every derived day rate is divided by.
 *
 * 220 is roughly 52 weeks less weekends, public holidays and a few weeks off.
 * The exact figure matters less than it being the same for everybody, which is
 * what makes the resulting medians comparable across people and countries.
 */
export const STANDARD_BILLED_DAYS = 220;

/** The working day an hourly rate is multiplied by, for the same reason. */
export const STANDARD_HOURS_PER_DAY = 8;

export type DayRateFailure = "missing_payments_per_year" | "implausible_multiplier";

export type DayRateResult =
  | { ok: true; perDay: number }
  | { ok: false; reason: DayRateFailure };

/**
 * The day rate implied by however this response quoted its pay.
 *
 * In the currency it was given in; converting to euro is the caller's job, the
 * same division of labour {@link annualise} and `totalCompEuro` already use.
 *
 * Base pay only. A day rate plus a bonus would be two different kinds of
 * number added together.
 */
export function dayRateOf(input: RateInput): DayRateResult {
  const period = input.salaryPeriod ?? "year";

  switch (period) {
    // Quoted as a price. Used exactly as given, which is the whole reason the
    // survey lets people answer in the unit they think in.
    case "day":
      return { ok: true, perDay: Math.round(input.baseSalary) };

    case "hour":
      return { ok: true, perDay: Math.round(input.baseSalary * STANDARD_HOURS_PER_DAY) };

    case "month": {
      const payments = input.paymentsPerYear;
      // Not defaulted to 12: a fourteen-payment year is normal in several
      // countries, and guessing would understate those rates by a seventh.
      if (payments == null) return { ok: false, reason: "missing_payments_per_year" };
      if (payments < 12 || payments > 14) return { ok: false, reason: "implausible_multiplier" };
      return {
        ok: true,
        perDay: Math.round((input.baseSalary * payments) / STANDARD_BILLED_DAYS),
      };
    }

    case "year":
      return { ok: true, perDay: Math.round(input.baseSalary / STANDARD_BILLED_DAYS) };
  }
}

/** What a day rate comes to over the standard year, for a like-for-like read. */
export function annualisedAtStandardYear(perDay: number): number {
  return Math.round(perDay * STANDARD_BILLED_DAYS);
}
