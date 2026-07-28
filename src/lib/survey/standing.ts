import { isDayRateEligible, isEmployeeContract, isHeadlineEligible } from "../stats/eligibility";

/**
 * What the confirmation screen is allowed to say about the answer just given.
 *
 * The screen used to say one thing: "You're the 4th engineer from Italy",
 * where the number came from `countForCountry`. That count is the *headline
 * eligible* count, and the sentence quietly assumed two things it does not
 * guarantee: that the answer just submitted is in it, and that it is therefore
 * at least one.
 *
 * Neither holds. A contractor's answer is deliberately excluded from that
 * count, so the first contractor to answer from a country was told they were
 * the 0th engineer from it. A same-day duplicate is silently kept as the first
 * answer rather than stored again, so the count does not move for that person
 * either. Both cases printed an ordinal that was false, on the one screen
 * whose whole job is to be worth trusting.
 *
 * So the decision is made here, from what the person actually answered, and it
 * is made in a pure function because "0th" is a thing the site must never say
 * again and a test can hold that.
 */

export type Answered = {
  contractType: string;
  ftePercent: number | null;
  salaryPeriod: string | null;
};

export type Standing =
  /** In the country's headline median, and we know where it landed. */
  | { kind: "position"; position: number }
  /**
   * In the headline median, but the live count does not show it. Reached by a
   * duplicate submission, whose first answer we kept. Claim nothing personal.
   */
  | { kind: "counted" }
  /** Not an employee, quoted per day: goes to the contractor day-rate cut. */
  | { kind: "day-rate" }
  /** Not an employee, and not a day rate: in the dataset and no median. */
  | { kind: "self-employed" }
  /** An employee below the full-time floor. */
  | { kind: "part-time" };

/**
 * @param answer  the response just submitted, as far as eligibility cares
 * @param headlineResponses  live count of headline-eligible responses for the
 *                           country, which includes this one when it qualifies
 */
export function standingOf(answer: Answered, headlineResponses: number): Standing {
  if (isHeadlineEligible(answer)) {
    return Number.isInteger(headlineResponses) && headlineResponses >= 1
      ? { kind: "position", position: headlineResponses }
      : { kind: "counted" };
  }
  if (isDayRateEligible(answer)) return { kind: "day-rate" };
  // Headline eligibility fails for an employee only on the full-time floor,
  // so the remaining employee case is exactly part-time.
  return isEmployeeContract(answer.contractType) ? { kind: "part-time" } : { kind: "self-employed" };
}

/** Which of the two published cuts this answer's progress bar should track. */
export function trackOf(standing: Standing): "headline" | "day-rate" {
  return standing.kind === "day-rate" ? "day-rate" : "headline";
}
