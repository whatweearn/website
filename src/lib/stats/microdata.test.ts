import { describe, expect, it } from "vitest";

import { MIN_CELL_SIZE } from "../thresholds";

import { type MicrodataRow, buildMicrodata, emptyMicrodata, yearsBand } from "./microdata";

const RATES = { EUR: 1, PLN: 4.3 };

function rows(count: number, overrides: Partial<MicrodataRow> = {}): MicrodataRow[] {
  return Array.from({ length: count }, (_, i) => ({
    country: "DE",
    level: "senior",
    contractType: "permanent",
    workSetup: "hybrid",
    discipline: "backend",
    companySize: "medium",
    industry: "software",
    yearsExperience: 8,
    baseSalary: 70_000 + i * 137,
    bonus: null,
    equityAnnual: null,
    currency: "EUR",
    ...overrides,
  }));
}

function dataLines(csv: string) {
  return csv.trim().split("\n").slice(1);
}

describe("yearsBand", () => {
  it("bands into fives", () => {
    expect(yearsBand(0)).toBe("0-4");
    expect(yearsBand(4)).toBe("0-4");
    expect(yearsBand(5)).toBe("5-9");
    expect(yearsBand(12)).toBe("10-14");
  });

  it("caps the long tail, where exact years identify people", () => {
    expect(yearsBand(25)).toBe("25+");
    expect(yearsBand(41)).toBe("25+");
  });

  it("keeps unknown distinct from zero", () => {
    expect(yearsBand(null)).toBe("unknown");
  });
});

describe("buildMicrodata", () => {
  it("releases a group that meets the minimum", () => {
    const { csv, released, withheld } = buildMicrodata(rows(MIN_CELL_SIZE), RATES);
    expect(released).toBe(MIN_CELL_SIZE);
    expect(withheld).toBe(0);
    expect(dataLines(csv)).toHaveLength(MIN_CELL_SIZE);
  });

  it("withholds a group one short of the minimum", () => {
    // A raw row is a cut of one. Publishing rows verbatim would break the
    // suppression promise the moment somebody sorted the file.
    const { released, withheld } = buildMicrodata(rows(MIN_CELL_SIZE - 1), RATES);
    expect(released).toBe(0);
    expect(withheld).toBe(MIN_CELL_SIZE - 1);
  });

  it("withholds a lone unusual person while releasing the crowd around them", () => {
    const mixed = [
      ...rows(20),
      ...rows(1, { country: "CZ", level: "principal", discipline: "embedded" }),
    ];
    const { csv, released, withheld } = buildMicrodata(mixed, RATES);

    expect(released).toBe(20);
    expect(withheld).toBe(1);
    expect(csv).not.toContain("CZ");
  });

  it("never emits a city, the most identifying field we hold", () => {
    const { csv } = buildMicrodata(rows(10), RATES);
    expect(csv.split("\n")[0]).not.toContain("city");
  });

  it("rounds pay so an exact figure cannot fingerprint a row", () => {
    // Anyone who knows one person's salary could otherwise locate their row
    // and read every other attribute on it.
    const { csv } = buildMicrodata(rows(10), RATES);
    for (const line of dataLines(csv)) {
      const total = Number(line.split(",").at(-1));
      expect(total % 500).toBe(0);
    }
  });

  it("bands experience rather than publishing exact years", () => {
    const { csv } = buildMicrodata(rows(10, { yearsExperience: 8 }), RATES);
    expect(dataLines(csv)[0]).toContain("5-9");
    expect(dataLines(csv)[0]).not.toMatch(/,8,/);
  });

  it("converts to euro so the column is comparable across countries", () => {
    const polish = buildMicrodata(
      rows(10, { country: "PL", currency: "PLN", baseSalary: 215_000, bonus: null }),
      RATES,
    );
    const total = Number(dataLines(polish.csv)[0]!.split(",").at(-1));
    expect(total).toBeGreaterThan(45_000);
    expect(total).toBeLessThan(55_000);
  });

  it("counts rows it could not convert as withheld rather than dropping them quietly", () => {
    const { released, withheld } = buildMicrodata(rows(10, { currency: "XYZ" }), RATES);
    expect(released).toBe(0);
    expect(withheld).toBe(10);
  });

  it("emits a valid header-only file when there is nothing to release", () => {
    const { csv } = buildMicrodata([], RATES);
    expect(csv).toBe(emptyMicrodata());
    expect(csv.trim().split("\n")).toHaveLength(1);
  });

  it("gives every released row the same column count as the header", () => {
    const { csv } = buildMicrodata(rows(10), RATES);
    const width = csv.split("\n")[0]!.split(",").length;
    for (const line of dataLines(csv)) {
      expect(line.split(",")).toHaveLength(width);
    }
  });
});

describe("determinism", () => {
  it("produces byte-identical output for the same data in any order", () => {
    // The dataset is committed nightly. A file that reshuffles on every run
    // would make the version history useless as a record of what was
    // published when.
    const sample = [...rows(6), ...rows(6, { country: "PL", currency: "PLN" })];
    const forwards = buildMicrodata(sample, RATES).csv;
    const backwards = buildMicrodata([...sample].reverse(), RATES).csv;
    expect(forwards).toBe(backwards);
  });
});
