/**
 * Which population a response belongs to, and what it is measured in.
 *
 * This module replaces the old `isHeadlineEligible`, and the difference is the
 * whole point. That rule was a **gate**: employees on full-time standard
 * contracts produced figures, and everyone else was dropped before anything
 * was computed. Half the responses this survey actually receives are
 * contractors, so half the people answering nine questions were told, in five
 * different places, that their answer was not comparable and therefore not
 * counted. The arithmetic behind that was right and the message was wrong.
 *
 * So comparability stops being a gate and becomes an **axis**. Every response
 * belongs to exactly one population, every population publishes on its own
 * count against its own threshold, and no response is excluded from figures
 * for being the wrong kind of worker.
 *
 * What survives from the old rule is narrower and sharper: **never mix
 * populations, and never convert between units of measure.** A contractor's
 * gross carries social contributions an employer would otherwise pay, so it is
 * far higher for the same take-home and averaging it with employed gross
 * produces a number describing nobody. A part-time salary scaled to full time
 * is a salary nobody is paid. Both remain true; neither is a reason to publish
 * nothing.
 *
 * See CLAUDE.md §7 and §9.
 */

/** Contracts under which someone is employed rather than self-employed. */
export const EMPLOYEE_CONTRACTS = ["permanent", "fixed_term"] as const;

/**
 * Below this, a contract is part-time.
 *
 * Part-timers are published as they are actually paid, never scaled up: the
 * scaling is what would invent a figure, not the inclusion.
 */
export const MIN_FTE_PERCENT = 90;

const EMPLOYEE_CONTRACT_SET: ReadonlySet<string> = new Set(EMPLOYEE_CONTRACTS);

export function isEmployeeContract(contractType: string): boolean {
  return EMPLOYEE_CONTRACT_SET.has(contractType);
}

/**
 * The three populations this survey publishes.
 *
 * Each has its own unit, its own threshold and its own progress. They are
 * peers: there is no "headline" population any more, which is why the explorer
 * asks which one you want rather than defaulting to one and burying the rest.
 */
export const POPULATIONS = ["employee", "part_time", "contractor"] as const;
export type Population = (typeof POPULATIONS)[number];

/** What a population's figures are denominated in. Never mixed. */
export type Unit = "year" | "day";

export const POPULATION_UNIT: Readonly<Record<Population, Unit>> = {
  employee: "year",
  part_time: "year",
  // A contractor's number is a price, not an income. See ./dayRate.
  contractor: "day",
};

/** The minimum a row needs to expose for the rule to be decidable. */
export type PopulationInput = {
  contractType: string;
  ftePercent: number | null;
};

export function populationOf(row: PopulationInput): Population {
  if (!isEmployeeContract(row.contractType)) return "contractor";
  return row.ftePercent !== null && row.ftePercent < MIN_FTE_PERCENT ? "part_time" : "employee";
}

export function isPopulation(value: string): value is Population {
  return (POPULATIONS as readonly string[]).includes(value);
}

/**
 * How each population is described wherever the site names it.
 *
 * One table rather than conditionals scattered through the components, because
 * these strings have to agree with each other across the explorer, the country
 * table, the confirmation screen and the share message. `figures` and `verb`
 * travel together: "day rates publish" and "median publishes" differ in number
 * and the sentence has to survive either.
 */
export const POPULATION_LABELS: Readonly<
  Record<
    Population,
    {
      /** Column headings and filter options. */
      short: string;
      /** Where there is room to be unambiguous. */
      long: string;
      /** Reads after a figure: "€650 a day". */
      unit: "a year" | "a day";
      /** Reads after an ordinal: "the 4th contractor from Italy". */
      member: string;
      /** Reads as a subject: "Italy's contractor day rates publish". */
      figures: string;
      verb: "publish" | "publishes";
    }
  >
> = {
  employee: {
    short: "Employees",
    long: "Employees, full-time",
    unit: "a year",
    member: "engineer",
    figures: "median",
    verb: "publishes",
  },
  part_time: {
    short: "Part-time",
    long: "Employees, part-time",
    unit: "a year",
    member: "part-time engineer",
    figures: "part-time median",
    verb: "publishes",
  },
  contractor: {
    short: "Contractors",
    long: "Contractors and B2B",
    unit: "a day",
    member: "contractor",
    figures: "contractor day rates",
    verb: "publish",
  },
};
