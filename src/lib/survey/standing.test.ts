import { describe, expect, it } from "vitest";

import { CONTRACT_TYPES, valuesOf } from "./options";
import { standingOf, trackOf, type Answered } from "./standing";

const employee: Answered = { contractType: "permanent", ftePercent: 100, salaryPeriod: "year" };
const contractor: Answered = { contractType: "contractor", ftePercent: null, salaryPeriod: "day" };

describe("standing on the confirmation screen", () => {
  it("places an employee at the count, which includes their own answer", () => {
    expect(standingOf(employee, 4)).toEqual({ kind: "position", position: 4 });
    expect(standingOf(employee, 1)).toEqual({ kind: "position", position: 1 });
  });

  /**
   * The bug this module exists for. Every one of these once produced "You're
   * the 0th engineer from Italy": a contractor, because the count deliberately
   * excludes them, and a duplicate submission, because the first answer is
   * kept rather than stored again so the count never moves.
   */
  it("never claims a position when the count does not contain the answer", () => {
    const counts = [0, -1, 0.5, Number.NaN];
    const answers: Answered[] = [
      employee,
      contractor,
      { contractType: "b2b", ftePercent: 100, salaryPeriod: "year" },
      { contractType: "permanent", ftePercent: 60, salaryPeriod: "year" },
    ];
    for (const answer of answers) {
      for (const n of counts) {
        expect(standingOf(answer, n), `${answer.contractType} at ${n}`).not.toHaveProperty(
          "position",
        );
      }
    }
  });

  it("says nothing personal when an eligible answer is not in the count yet", () => {
    expect(standingOf(employee, 0)).toEqual({ kind: "counted" });
  });

  it("sends a quoted day rate to the contractor cut", () => {
    expect(standingOf(contractor, 0)).toEqual({ kind: "day-rate" });
    // Its own cut publishes on its own count, so it tracks that one.
    expect(trackOf(standingOf(contractor, 0))).toBe("day-rate");
  });

  it("separates a self-employed annual figure from a part-time employee", () => {
    // Two different exclusions with two different explanations owed. B2B is
    // out because the gross is not comparable; a 60% contract is out because
    // scaling it up would invent a salary.
    expect(standingOf({ ...contractor, salaryPeriod: "year" }, 3)).toEqual({
      kind: "self-employed",
    });
    expect(standingOf({ contractType: "fixed_term", ftePercent: 60, salaryPeriod: "year" }, 3)).toEqual(
      { kind: "part-time" },
    );
  });

  /**
   * Every contract type the survey offers has to reach a branch that says
   * something true, including one added later. A new option defaulting into
   * the employee ordinal is the failure mode worth catching.
   */
  it("decides for every contract type the survey can produce", () => {
    for (const contractType of valuesOf(CONTRACT_TYPES)) {
      for (const ftePercent of [null, 100, 60]) {
        for (const salaryPeriod of ["year", "month", "day", "hour", null]) {
          const standing = standingOf({ contractType, ftePercent, salaryPeriod }, 7);
          expect(["position", "counted", "day-rate", "self-employed", "part-time"]).toContain(
            standing.kind,
          );
        }
      }
    }
  });

  it("tracks the headline count for everyone outside the day-rate cut", () => {
    for (const answer of [employee, { ...contractor, salaryPeriod: "year" }]) {
      expect(trackOf(standingOf(answer, 7))).toBe("headline");
    }
  });
});
