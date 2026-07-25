/**
 * Currency conversion and total-compensation normalisation.
 *
 * Rates are units of the currency per one euro, as the ECB publishes them.
 */

export type RateTable = Readonly<Record<string, number>>;

export class MissingRateError extends Error {
  constructor(readonly currency: string) {
    super(`No exchange rate for ${currency}`);
    this.name = "MissingRateError";
  }
}

export function toEuro(amount: number, currency: string, rates: RateTable): number {
  if (currency === "EUR") return amount;
  const perEur = rates[currency];
  // Throwing beats defaulting to 1: silently treating złoty as euro would put
  // Polish salaries roughly 4× too high and nothing would look wrong.
  if (!perEur || perEur <= 0) throw new MissingRateError(currency);
  return amount / perEur;
}

export type CompensationInput = {
  baseSalary: number;
  bonus?: number | null;
  equityAnnual?: number | null;
  currency: string;
};

/**
 * Total compensation in euro: base plus bonus plus annualised equity.
 *
 * The entered base is already an annual figure, so `paymentsPerYear` is *not*
 * a multiplier — it is context for interpreting local norms and for flagging
 * someone who entered a monthly amount. Multiplying here would inflate every
 * Spanish and Portuguese salary by 17%.
 */
export function totalCompEuro(input: CompensationInput, rates: RateTable): number {
  const gross = input.baseSalary + (input.bonus ?? 0) + (input.equityAnnual ?? 0);
  return Math.round(toEuro(gross, input.currency, rates));
}
