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

/** Annualised and roughly converted to euro. Validation only. */
export function annualEuroApprox(input: RateInput & { currency: string }): number | null {
  const annual = annualOrNull(input);
  if (annual === null) return null;
  const perEur = APPROX_EUR_RATES[input.currency];
  if (!perEur || perEur <= 0) return null;
  return Math.round(annual / perEur);
}

const format = (value: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export function checkSalary(input: RateInput & { currency: string }): SalaryCheck {
  const annualEuro = annualEuroApprox(input);

  // Cannot be judged — a missing multiplier is caught separately, and guessing
  // one here just to run a bounds check would defeat the point.
  if (annualEuro === null) return { verdict: "ok", annualEuro: null };

  if (annualEuro < SALARY_BOUNDS.impossible.min) {
    return {
      verdict: "impossible",
      annualEuro,
      message: `That works out to about ${format(annualEuro)} a year. Check the amount and the period — a monthly or daily figure entered as yearly is the usual cause.`,
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
