import { STANDARD_BILLED_DAYS, STANDARD_HOURS_PER_DAY } from "../stats/dayRate";

import { type RateInput, annualOrNull } from "./annualise";

/**
 * Order-of-magnitude sanity checks on pay.
 *
 * Two things have to be true at once for this to work: the figure must be
 * annualised (200 a year is nonsense, 200 a day is a normal contractor) and it
 * must be in a common currency (3,000 is a fine monthly salary in euro and
 * about €7.50 in forint). Checking the raw number against a fixed threshold —
 * which is what this code used to do — is wrong on both counts.
 */

/**
 * Approximate units per euro, for validation only.
 *
 * **Never used for published figures.** Those convert at the European Central
 * Bank's daily rates, stored per day so results are reproducible. These exist
 * so the survey can reject a typo instantly, client-side, without a database
 * round trip — and being 20% stale makes no difference to a check that is
 * asking whether a number is off by a factor of a hundred.
 */
export const APPROX_EUR_RATES: Readonly<Record<string, number>> = {
  EUR: 1,
  GBP: 0.85,
  CHF: 0.95,
  SEK: 11.2,
  NOK: 11.5,
  DKK: 7.5,
  PLN: 4.3,
  CZK: 25,
  HUF: 395,
  RON: 5,
  BGN: 1.96,
  RSD: 117,
  UAH: 45,
  USD: 1.08,
};

/**
 * Bounds on annual total base pay, in euro.
 *
 * `impossible` is typo territory: not a salary anyone is paid, in any European
 * country, at any level. `suspect` is merely unusual — flagged for review,
 * never refused, because the lowest-paid junior in Ukraine and the highest-paid
 * principal in Zurich are both real people whose answers we want.
 */
export const SALARY_BOUNDS = {
  impossible: { min: 1_000, max: 3_000_000 },
  suspect: { min: 5_000, max: 500_000 },
} as const;

export type Verdict = "ok" | "suspect" | "impossible";

export type SalaryCheck = {
  verdict: Verdict;
  /** Annualised and converted, or null when it could not be worked out. */
  annualEuro: number | null;
  /** Shown to the person. Empty when the figure is fine. */
  message?: string;
};

/**
 * Annualised and roughly converted to euro. Validation only.
 *
 * Falls back to the standard working year when a day or hour count is missing,
 * which published figures never do. The two are different jobs: publishing a
 * figure nobody supplied would be inventing data, while *declining to check* a
 * figure is how a €650,000 day rate reaches the database untouched. A
 * contractor is no longer asked for their billed days at all, so without this
 * fallback the entire typo defence would be switched off for them.
 */
export function annualEuroApprox(input: RateInput & { currency: string }): number | null {
  const annual = annualOrNull(atStandardYear(input));
  if (annual === null) return null;
  const perEur = APPROX_EUR_RATES[input.currency];
  if (!perEur || perEur <= 0) return null;
  return Math.round(annual / perEur);
}

/**
 * The same rate with a standard multiplier where none was given.
 *
 * Their own count wins when they gave one: somebody who says they billed 140
 * days should see the check run against the year they actually described.
 */
function atStandardYear<T extends RateInput>(input: T): T {
  if (input.salaryPeriod === "day" && input.daysPerYear == null) {
    return { ...input, daysPerYear: STANDARD_BILLED_DAYS };
  }
  if (input.salaryPeriod === "hour" && input.hoursPerYear == null) {
    return { ...input, hoursPerYear: STANDARD_BILLED_DAYS * STANDARD_HOURS_PER_DAY };
  }
  return input;
}

const format = (value: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export function checkSalary(input: RateInput & { currency: string }): SalaryCheck {
  const annualEuro = annualEuroApprox(input);

  // Cannot be judged: an unknown currency, or a monthly figure with no payment
  // count. The latter is caught separately, and there is no standard to fall
  // back on — 12, 13 and 14 are all normal, and picking one would be guessing
  // at the answer rather than at the working year.
  if (annualEuro === null) return { verdict: "ok", annualEuro: null };

  if (annualEuro < SALARY_BOUNDS.impossible.min) {
    return {
      verdict: "impossible",
      annualEuro,
      message: `That works out to about ${format(annualEuro)} a year. Check the amount and the period. A monthly or daily figure entered as yearly is the usual cause.`,
    };
  }

  if (annualEuro > SALARY_BOUNDS.impossible.max) {
    return {
      verdict: "impossible",
      annualEuro,
      message: `That works out to about ${format(annualEuro)} a year, which is beyond anything we can treat as a salary. Check for an extra digit.`,
    };
  }

  if (annualEuro < SALARY_BOUNDS.suspect.min) {
    return {
      verdict: "suspect",
      annualEuro,
      message: `That is about ${format(annualEuro)} a year, which is low even for the lowest-paying markets here. Send it if it is right.`,
    };
  }

  if (annualEuro > SALARY_BOUNDS.suspect.max) {
    return {
      verdict: "suspect",
      annualEuro,
      message: `That is about ${format(annualEuro)} a year, which is very high. Send it if it is right.`,
    };
  }

  return { verdict: "ok", annualEuro };
}
