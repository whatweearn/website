import { type Population, populationOf } from "../stats/populations";

/**
 * What the confirmation screen is allowed to say about the answer just given.
 *
 * The screen used to take the live employee count and print it as an ordinal:
 * "You're the 4th engineer from Italy". That count never contained a
 * contractor's answer, so the first contractor from a country was told they
 * were its 0th engineer, and a duplicate submission — where the first answer
 * is kept rather than stored again — moved no count at all.
 *
 * Now that every population publishes on its own count, the placement is a
 * real statement again: it is a position within the population the answer
 * actually belongs to. What remains is the guard that started this module.
 * "0th" is a thing the site must never say, and a pure function with a test
 * can hold that where a JSX conditional could not.
 */

export type Answered = {
  contractType: string;
  ftePercent: number | null;
  salaryPeriod: string | null;
};

export type Standing =
  /** In this population's count, and we know where it landed. */
  | { kind: "position"; population: Population; position: number }
  /**
   * In the count, but the count does not show it. Reached by a duplicate
   * submission, whose earlier answer we kept. Claim nothing personal.
   */
  | { kind: "counted"; population: Population };

/**
 * @param answer  the response just submitted, as far as population cares
 * @param responses  live count for that population in that country, which
 *                   includes this answer unless it was a duplicate
 */
export function standingOf(answer: Answered, responses: number): Standing {
  const population = populationOf(answer);
  return Number.isInteger(responses) && responses >= 1
    ? { kind: "position", population, position: responses }
    : { kind: "counted", population };
}

export { populationOf } from "../stats/populations";
