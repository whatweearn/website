import { describe, expect, it } from "vitest";

import { POPULATIONS } from "../stats/populations";

import { CONTRACT_TYPES, valuesOf } from "./options";
import { standingOf, type Answered } from "./standing";

const employee: Answered = { contractType: "permanent", ftePercent: 100, salaryPeriod: "year" };
const contractor: Answered = { contractType: "contractor", ftePercent: null, salaryPeriod: "day" };

describe("standing on the confirmation screen", () => {
  it("places an answer at the count for its own population", () => {
    expect(standingOf(employee, 4)).toEqual({
      kind: "position",
      population: "employee",
      position: 4,
    });
    expect(standingOf(contractor, 1)).toEqual({
      kind: "position",
      population: "contractor",
      position: 1,
    });
  });

  /**
   * The bug this module exists for. Every one of these once produced "You're
   * the 0th engineer from Italy": a contractor, because the count they were
   * shown was the employee count they were never in, and a duplicate
   * submission, because the first answer is kept rather than stored again so
   * no count moves.
   */
  it("never claims a position the count cannot support", () => {
    const answers: Answered[] = [
      employee,
      contractor,
      { contractType: "b2b", ftePercent: 100, salaryPeriod: "year" },
      { contractType: "permanent", ftePercent: 60, salaryPeriod: "year" },
    ];
    for (const answer of answers) {
      for (const responses of [0, -1, 0.5, Number.NaN]) {
        expect(standingOf(answer, responses), `${answer.contractType} at ${responses}`).not.toHaveProperty(
          "position",
        );
      }
    }
  });

  it("says nothing personal when the count does not contain the answer yet", () => {
    expect(standingOf(employee, 0)).toEqual({ kind: "counted", population: "employee" });
  });

  it("separates part-time employees from full-time and from the self-employed", () => {
    // Three populations, three thresholds, three different sentences. Sharing
    // one would put a contractor's answer next to an employee gap they cannot
    // close.
    expect(standingOf({ ...employee, ftePercent: 60 }, 3)).toMatchObject({
      population: "part_time",
    });
    expect(standingOf({ ...contractor, ftePercent: 60 }, 3)).toMatchObject({
      population: "contractor",
    });
  });

  /**
   * Every contract type the survey offers has to reach a population, including
   * one added later. A new option falling through to the employee count is the
   * failure mode worth catching.
   */
  it("decides for every contract type the survey can produce", () => {
    for (const contractType of valuesOf(CONTRACT_TYPES)) {
      for (const ftePercent of [null, 100, 60]) {
        for (const salaryPeriod of ["year", "month", "day", "hour", null]) {
          const standing = standingOf({ contractType, ftePercent, salaryPeriod }, 7);
          expect(POPULATIONS).toContain(standing.population);
        }
      }
    }
  });
});
