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
  /** Already annualised. See survey/annualise.ts. */
  annualBase: number;
  bonus?: number | null;
  equityAnnual?: number | null;
  currency: string;
};

/**
 * Total compensation in euro: annual base plus bonus plus annualised equity.
 *
 * The base arrives already annualised, because how it was quoted — yearly,
 * monthly, daily, hourly — and the multiplier that converts it are survey
 * concerns, not currency ones. Keeping them apart means neither has to know
 * about the other.
 */
export function totalCompEuro(input: CompensationInput, rates: RateTable): number {
  const gross = input.annualBase + (input.bonus ?? 0) + (input.equityAnnual ?? 0);
  return Math.round(toEuro(gross, input.currency, rates));
}
