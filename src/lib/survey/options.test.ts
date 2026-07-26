import { describe, expect, it } from "vitest";

import {
  CITIES,
  CONTRACT_LOCAL_TERMS,
  CONTRACT_TYPES,
  COUNTRIES,
  DISCIPLINES,
  ELSEWHERE,
  LEVELS,
  citiesFor,
  contractTypesFor,
  valuesOf,
  type ContractType,
  type CountryCode,
} from "./options";

const GENERIC = Object.fromEntries(CONTRACT_TYPES.map((c) => [c.value, c.hint])) as Record<
  ContractType,
  string
>;

const LOCALISED = Object.keys(CONTRACT_LOCAL_TERMS) as CountryCode[];

describe("roles", () => {
  /**
   * A repeated value is not a visible bug: both cards render, the second one
   * shares an input id with the first, and clicking either selects one of them
   * while the other silently stops working. Cheap to assert, hard to spot.
   */
  it("lists no value twice", () => {
    for (const [name, options] of [
      ["DISCIPLINES", DISCIPLINES],
      ["LEVELS", LEVELS],
    ] as const) {
      const values = valuesOf(options);
      expect(new Set(values).size, `${name} repeats a value`).toBe(values.length);
    }
  });

  /**
   * Architecture is deliberately in both lists (a discipline and a track), and
   * the values are deliberately different strings. If they ever collide, a row
   * of the published CSV carries the same token in the discipline and level
   * columns meaning two different things, and every reader has to guess.
   */
  it("keeps discipline values distinct from level values", () => {
    const levels = new Set<string>(valuesOf(LEVELS));
    const shared = valuesOf(DISCIPLINES).filter((value) => levels.has(value));
    expect(shared, "a discipline and a level share a stored value").toEqual([]);
  });

  /**
   * The level screen tells people to choose by what they do rather than by
   * their title, which only works if every option says what that is. One
   * hintless card in a list of hinted ones reads as an unfinished form.
   */
  it("describes every level", () => {
    for (const level of LEVELS) {
      expect(level.hint, `${level.value} has no description`).toBeTruthy();
    }
  });
});

describe("citiesFor", () => {
  /**
   * The type already makes this a build error rather than a test failure. It
   * is asserted anyway because the failure it prevents is not a crash: a
   * country with no hubs renders a select whose only option is "Elsewhere",
   * under a hint asking the respondent to pick the nearest one. That reads as
   * a broken form on the first screen of the survey, which is the worst place
   * to spend someone's confidence.
   */
  it("offers at least the capital for every country the survey accepts", () => {
    for (const country of COUNTRIES) {
      const cities = citiesFor(country.code);
      expect(cities.length, `${country.name} has no hub`).toBeGreaterThan(1);
    }
  });

  it("always ends on the catch-all, so no country is a closed list", () => {
    for (const country of COUNTRIES) {
      expect(citiesFor(country.code).at(-1)).toBe(ELSEWHERE);
    }
  });

  it("lists no city twice within a country", () => {
    for (const country of COUNTRIES) {
      const cities = citiesFor(country.code);
      expect(new Set(cities).size, `${country.name} repeats a city`).toBe(cities.length);
    }
  });

  it("names hubs only for countries the survey offers", () => {
    const offered = new Set(COUNTRIES.map((c) => c.code));
    for (const code of Object.keys(CITIES)) {
      expect(offered.has(code as CountryCode), `${code} is not in COUNTRIES`).toBe(true);
    }
  });
});

describe("contractTypesFor", () => {
  /**
   * The whole point of localising these options is that the *answer* stays
   * comparable across countries. If a translation could ever reach the stored
   * value, a German response and a Polish one would no longer aggregate
   * together, and every cut in the site would silently fragment by language.
   */
  it("never localises the stored value, in any country", () => {
    const expected = valuesOf(CONTRACT_TYPES);
    for (const country of COUNTRIES) {
      expect(contractTypesFor(country.code).map((o) => o.value)).toEqual(expected);
    }
  });

  it("keeps option order identical in every country", () => {
    const expected = CONTRACT_TYPES.map((c) => c.label);
    for (const country of COUNTRIES) {
      expect(contractTypesFor(country.code).map((o) => o.label)).toEqual(expected);
    }
  });

  it("falls back to the generic hints before a country is chosen", () => {
    expect(contractTypesFor()).toEqual(
      CONTRACT_TYPES.map((c) => ({ value: c.value, label: c.label, hint: c.hint })),
    );
  });

  it("falls back to the generic hints for a country with no terms recorded", () => {
    // Switzerland is deliberately absent: three working languages, and picking
    // one would mislead speakers of the other two.
    expect(CONTRACT_LOCAL_TERMS.CH).toBeUndefined();
    expect(contractTypesFor("CH").map((o) => o.hint)).toEqual(CONTRACT_TYPES.map((c) => c.hint));
  });

  it("uses the local term where one is recorded", () => {
    const hints = Object.fromEntries(contractTypesFor("PL").map((o) => [o.value, o.hint]));
    expect(hints.permanent).toBe("Umowa o pracę na czas nieokreślony");
    expect(hints.b2b).toBe("Kontrakt B2B (JDG)");
  });

  /**
   * The failure this guards is subtle: a German seeing "Freiberuflich, auf
   * Rechnung" next to "Company-to-company, through your own business" gets a
   * screen half in each language, which reads as an oversight and undermines
   * exactly the confidence the local terms were added to build.
   */
  it("covers every contract type for a country it covers at all", () => {
    for (const country of LOCALISED) {
      const missing = CONTRACT_TYPES.filter((c) => !CONTRACT_LOCAL_TERMS[country]?.[c.value]).map(
        (c) => c.value,
      );
      expect(missing, `${country} is partially localised`).toEqual([]);
    }
  });

  it("localises only countries the survey actually offers", () => {
    const offered = new Set(COUNTRIES.map((c) => c.code));
    for (const country of LOCALISED) {
      expect(offered.has(country), `${country} is not in COUNTRIES`).toBe(true);
    }
  });

  it("says something different from the generic hint wherever it is localised", () => {
    for (const country of LOCALISED) {
      for (const option of contractTypesFor(country)) {
        expect(option.hint, `${country}/${option.value} repeats the generic hint`).not.toBe(
          GENERIC[option.value],
        );
      }
    }
  });
});
