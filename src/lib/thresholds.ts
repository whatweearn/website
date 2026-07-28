/**
 * Publication thresholds.
 *
 * These numbers are quoted verbatim on the public site and in the methodology
 * page. They exist here once so the copy and the aggregation layer can never
 * drift apart. Never inline these values — import them.
 *
 * See CLAUDE.md §7.
 */

import { POPULATION_UNIT, type Population } from "./stats/populations";

/**
 * Cell suppression. Any published cut of the data with fewer than this many
 * responses is withheld entirely.
 *
 * This is the privacy rule: it is what stops "principal engineer, Ljubljana,
 * 15 years" from being one identifiable person.
 */
export const MIN_CELL_SIZE = 5;

/**
 * A country's salary figures publish once it clears this many responses.
 *
 * This is a *statistical* rule, not a privacy one — distinct from
 * {@link MIN_CELL_SIZE} and deliberately much higher. A median over six people
 * is not a median worth printing.
 *
 * Applies per population, not per country: employees and part-time employees
 * each need this many of their own. See {@link publishMinFor}.
 */
export const COUNTRY_PUBLISH_MIN = 60;

/**
 * A country's contractor day-rate median publishes once it clears this many
 * quoted day rates.
 *
 * Deliberately lower than {@link COUNTRY_PUBLISH_MIN}, and the reason is
 * statistical rather than a concession to low volume. A day rate is a single
 * negotiated price: no bonus, no equity, no thirteenth month, no part-time
 * fraction, none of the variance that makes total compensation a wide
 * distribution needing sixty observations to pin down. It also carries none of
 * that variance's asymmetry, so the median settles far sooner.
 *
 * It remains five times {@link MIN_CELL_SIZE}, because the privacy floor and
 * the statistical floor are different rules and this is the statistical one.
 * Quoted on the methodology page — keep the two in step.
 */
export const DAY_RATE_PUBLISH_MIN = 25;

/** Whether a country's day-rate figures may be published. */
export function isDayRatePublishable(rates: number): boolean {
  assertCount(rates, "rates");
  return rates >= DAY_RATE_PUBLISH_MIN;
}

/** How many more day rates a country needs before its median publishes. */
export function dayRatesUntilPublish(rates: number): number {
  assertCount(rates, "rates");
  return Math.max(0, DAY_RATE_PUBLISH_MIN - rates);
}

/**
 * The threshold a population publishes on.
 *
 * Every population has one, and the difference between them is statistical
 * rather than editorial: annual total compensation is a wide, asymmetric
 * distribution that needs sixty observations to pin a median down, while a day
 * rate is a single negotiated price carrying none of that variance. A lower
 * bar for contractors is not a lower standard applied to get something on the
 * page sooner — it is the same standard applied to a narrower quantity.
 */
export function publishMinFor(population: Population): number {
  return POPULATION_UNIT[population] === "day" ? DAY_RATE_PUBLISH_MIN : COUNTRY_PUBLISH_MIN;
}

/** Whether this many responses publish, for this population. */
export function isPublishable(population: Population, responses: number): boolean {
  assertCount(responses, "responses");
  return responses >= publishMinFor(population);
}

/** How many more responses this population needs in this cut. */
export function untilPublish(population: Population, responses: number): number {
  assertCount(responses, "responses");
  return Math.max(0, publishMinFor(population) - responses);
}

/** Percentiles at which published statistics are trimmed. Both ends. */
export const TRIM_LOWER_PERCENTILE = 1;
export const TRIM_UPPER_PERCENTILE = 99;

function assertCount(n: number, label: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${label} must be a non-negative integer, received ${n}`);
  }
}

/** Whether a single cut of the data may be shown at all. */
export function isCellPublishable(responses: number): boolean {
  assertCount(responses, "responses");
  return responses >= MIN_CELL_SIZE;
}

/** Whether a country's aggregate figures may be published. */
export function isCountryPublishable(responses: number): boolean {
  assertCount(responses, "responses");
  return responses >= COUNTRY_PUBLISH_MIN;
}

/**
 * How many more responses a country needs before it publishes.
 *
 * Drives the "19 more to publish" copy in the results table, which is why it
 * clamps at zero rather than going negative.
 */
export function responsesUntilPublish(responses: number): number {
  assertCount(responses, "responses");
  return Math.max(0, COUNTRY_PUBLISH_MIN - responses);
}
