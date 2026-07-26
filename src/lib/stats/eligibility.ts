/**
 * Which responses count towards a country's headline median.
 *
 * This rule lives alone, in its own module, because it is applied in two
 * places that must never disagree:
 *
 * 1. the nightly aggregation, in TypeScript, which decides what publishes;
 * 2. `countForCountry`, in SQL, which is the live number the confirmation
 *    screen turns into "Germany needs 47 more before its median publishes".
 *
 * When those two measured different populations, the site could tell somebody
 * a country was three responses away and then decline to publish it, because
 * a dozen of the responses it had counted were B2B or part-time. A promise
 * that the aggregation quietly refuses to keep is worse than no promise.
 *
 * See CLAUDE.md §9 (Phase 3 inclusion rules) and §10 ("named constants in one
 * module, never inlined").
 */

/**
 * Contracts whose gross figures are comparable with one another.
 *
 * B2B and freelance gross carries the worker's social contributions, so it is
 * dramatically higher for the same take-home. Averaging it together with
 * employed gross produces a number that describes nobody — this is the single
 * most distorting mistake available in European pay data, and excluding it
 * from headline figures is the fix. Those responses stay in the dataset and
 * get their own cut; they just do not contaminate "what a country pays".
 */
export const EMPLOYEE_CONTRACTS = ["permanent", "fixed_term"] as const;

/**
 * Anything below this is not extrapolated to a full-time figure.
 *
 * Scaling a 60% contract up to 100% invents a salary nobody is paid. Omitting
 * part-timers from headline medians is the honest alternative; the dataset
 * still contains them.
 */
export const MIN_FTE_PERCENT = 90;

const EMPLOYEE_CONTRACT_SET: ReadonlySet<string> = new Set(EMPLOYEE_CONTRACTS);

export function isEmployeeContract(contractType: string): boolean {
  return EMPLOYEE_CONTRACT_SET.has(contractType);
}

/** The minimum a row needs to expose for the rule to be decidable. */
export type EligibilityInput = {
  contractType: string;
  ftePercent: number | null;
};

export function isHeadlineEligible(row: EligibilityInput): boolean {
  if (!isEmployeeContract(row.contractType)) return false;
  if (row.ftePercent !== null && row.ftePercent < MIN_FTE_PERCENT) return false;
  return true;
}

/**
 * Which responses belong in the contractor day-rate view.
 *
 * Two conditions, and both matter.
 *
 * **Quoted per day.** Only rates the respondent actually gave as a day rate.
 * Deriving one by dividing an annual figure by billed days would put utilisation
 * straight back into a number whose whole purpose is to be free of it: €700 a
 * day is €154,000 over 220 billed days and €84,000 over 120, so a median of
 * annualised contractor income measures how much people worked as much as what
 * they charge. Hourly rates are excluded too, since converting them would mean
 * assuming the length of a working day.
 *
 * **Not an employee.** The same gross-versus-net problem that keeps B2B out of
 * the headline median applies in reverse here: an employee quoting a day rate
 * is not pricing the same thing as a contractor who carries their own social
 * contributions. Contractor and B2B sit together because both bear those
 * contributions; that is a far smaller difference than either has with
 * employment.
 */
export function isDayRateEligible(row: EligibilityInput & { salaryPeriod?: string | null }): boolean {
  if (isEmployeeContract(row.contractType)) return false;
  return row.salaryPeriod === "day";
}
