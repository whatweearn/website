import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { CountryRow, SiteStats } from "../stats";
import { COUNTRY_PUBLISH_MIN } from "../thresholds";
import {
  OUTREACH_LANGUAGES,
  bareCount,
  bestCountry,
  countryDayRates,
  countryResponses,
  draftProblems,
  fillOutreachTokens,
  phraseCount,
} from "./facts";
import { findDrafts, readDraft } from "./drafts";

const OUTREACH_DIR = fileURLToPath(new URL("../../../outreach", import.meta.url));

function country(name: string, responses: number): CountryRow {
  return { name, currency: "EUR", responses, median: null, p25: null, p75: null };
}

function stats(
  countries: CountryRow[],
  totalResponses = 0,
  dayRates: { name: string; responses: number }[] = [],
): SiteStats {
  return {
    totalResponses,
    countriesCovered: countries.length,
    europe: null,
    countries,
    dayRates: dayRates.map((d) => ({ ...d, median: null, p25: null, p75: null })),
    cuts: {},
  };
}

describe("phraseCount", () => {
  it("spells out the small numbers a cold start actually produces", () => {
    expect(phraseCount(0)).toBe("zero responses");
    expect(phraseCount(1)).toBe("one response");
    expect(phraseCount(9)).toBe("9 responses");
  });

  it("agrees with the sentence around it in every language a draft uses", () => {
    expect(phraseCount(0, "de")).toBe("null Antworten");
    expect(phraseCount(1, "de")).toBe("eine Antwort");
    expect(phraseCount(9, "de")).toBe("9 Antworten");
    // French takes the singular after "zéro".
    expect(phraseCount(0, "fr")).toBe("zéro réponse");
    expect(phraseCount(1, "es")).toBe("una respuesta");
    expect(phraseCount(1, "it")).toBe("una risposta");
    expect(phraseCount(1, "pt")).toBe("uma resposta");
  });

  it("applies the Romanian 'de' rule at the right boundaries", () => {
    expect(phraseCount(1, "ro")).toBe("un răspuns");
    expect(phraseCount(19, "ro")).toBe("19 răspunsuri");
    expect(phraseCount(20, "ro")).toBe("20 de răspunsuri");
    expect(phraseCount(100, "ro")).toBe("100 de răspunsuri");
    expect(phraseCount(101, "ro")).toBe("101 răspunsuri");
  });

  it("falls back to English rather than emitting a broken token", () => {
    expect(phraseCount(3, "xx")).toBe("3 responses");
  });
});

describe("bareCount", () => {
  it("drops the noun for a sentence that has already named it", () => {
    expect(bareCount(0)).toBe("none");
    expect(bareCount(1)).toBe("one");
    expect(bareCount(9)).toBe("9");
  });

  it("agrees with the gender each language gives a response", () => {
    expect(bareCount(0, "de")).toBe("keine");
    expect(bareCount(0, "fr")).toBe("aucune");
    expect(bareCount(0, "es")).toBe("ninguna");
    expect(bareCount(0, "it")).toBe("nessuna");
    expect(bareCount(0, "pt")).toBe("nenhuma");
    // "răspuns" is masculine, so the Romanian form is not "niciuna".
    expect(bareCount(0, "ro")).toBe("niciunul");
  });

  it("covers every language the phrase table does", () => {
    for (const lang of OUTREACH_LANGUAGES) {
      expect(bareCount(0, lang)).not.toBe(bareCount(1, lang));
    }
  });
});

describe("countryResponses", () => {
  it("reads the country the aggregation emitted", () => {
    expect(countryResponses(stats([country("Belgium", 4)]), "BE")).toBe(4);
  });

  it("treats a country the aggregation has never seen as zero", () => {
    expect(countryResponses(stats([country("Belgium", 4)]), "PL")).toBe(0);
  });

  it("does not throw on a code that is not a surveyed country", () => {
    expect(countryResponses(stats([]), "ZZ")).toBe(0);
  });
});

describe("countryDayRates", () => {
  it("reads a separate population from the salary count", () => {
    const s = stats([country("Belgium", 4)], 9, [{ name: "Belgium", responses: 7 }]);
    expect(countryDayRates(s, "BE")).toBe(7);
    expect(countryResponses(s, "BE")).toBe(4);
  });

  it("is zero for a country with no quoted rates, and for stats.json without the field", () => {
    expect(countryDayRates(stats([country("Belgium", 4)], 9), "BE")).toBe(0);
    expect(countryDayRates(stats([], 0, [{ name: "Poland", responses: 3 }]), "BE")).toBe(0);
  });
});

describe("fillOutreachTokens", () => {
  const live = stats([country("Belgium", 4), country("Poland", 11)], 9, [
    { name: "Belgium", responses: 7 },
  ]);

  it("fills the survey-wide count", () => {
    expect(fillOutreachTokens("It has {{RESPONSES}} in it.", live).text).toBe(
      "It has 9 responses in it.",
    );
  });

  it("fills a country count and the gap to publication", () => {
    const out = fillOutreachTokens("Belgium: {{RESPONSES:BE}}, {{NEEDS:BE}} to go.", live);
    expect(out.text).toBe(`Belgium: 4 responses, ${COUNTRY_PUBLISH_MIN - 4} to go.`);
  });

  it("fills a bare country count", () => {
    expect(fillOutreachTokens("{{RESPONSES}}, {{COUNT:BE}} from Belgium.", live).text).toBe(
      "9 responses, 4 from Belgium.",
    );
  });

  it("reports a bare count token missing its country", () => {
    expect(fillOutreachTokens("{{COUNT}}", live).unknown).toEqual(["{{COUNT}}"]);
  });

  it("never reports a negative gap once a country has published", () => {
    const done = stats([country("Poland", COUNTRY_PUBLISH_MIN + 12)]);
    expect(fillOutreachTokens("{{NEEDS:PL}}", done).text).toBe("0");
  });

  it("renders in the language the draft declares, and drops the directive", () => {
    const md = "<!-- outreach-lang: de -->\nEs sind aktuell {{RESPONSES}} drin.";
    expect(fillOutreachTokens(md, live).text).toBe("Es sind aktuell 9 Antworten drin.");
  });

  it("switches back for the English reference block the mods read", () => {
    const md = [
      "<!-- outreach-lang: de -->",
      "Aktuell {{RESPONSES}}.",
      "<!-- outreach-lang: en -->",
      "Currently {{RESPONSES}}.",
    ].join("\n");
    expect(fillOutreachTokens(md, live).text).toBe("Aktuell 9 Antworten.\nCurrently 9 responses.");
  });

  it("fills the day-rate count, its gap and its own threshold", () => {
    const out = fillOutreachTokens("{{DAY_RATES:BE}} of {{DAY_RATE_MIN}}, {{DAY_RATES_NEEDED:BE}} to go", live);
    expect(out.text).toBe("7 of 25, 18 to go");
  });

  it("does not confuse the day-rate threshold with the salary one", () => {
    const out = fillOutreachTokens("{{DAY_RATE_MIN}} vs {{PUBLISH_MIN}}", live);
    expect(out.text).toBe("25 vs 60");
  });

  it("quotes the thresholds from the constants rather than the draft", () => {
    expect(fillOutreachTokens("{{PUBLISH_MIN}} and {{MIN_CELL}}", live).text).toBe("60 and 5");
  });

  it("reports an unknown token instead of silently deleting it", () => {
    const out = fillOutreachTokens("{{MEDIAN}} today", live);
    expect(out.unknown).toEqual(["{{MEDIAN}}"]);
    expect(out.text).toBe("{{MEDIAN}} today");
  });

  it("reports a country token missing the country it needs", () => {
    expect(fillOutreachTokens("{{NEEDS}}", live).unknown).toEqual(["{{NEEDS}}"]);
  });
});

describe("bestCountry", () => {
  it("is the country nearest publication, not the newest", () => {
    expect(bestCountry(stats([country("Belgium", 4), country("Poland", 11)]))).toEqual({
      name: "Poland",
      responses: 11,
    });
  });

  it("is null before anything has arrived", () => {
    expect(bestCountry(stats([country("Belgium", 0)]))).toBeNull();
  });
});

/**
 * `draftProblems` is the guard; this is the check that it says yes to the real
 * drafts.
 *
 * Written because the first version of these posts hardcoded "zero responses"
 * in 35 files, which stopped being true the day after launch. A frozen number
 * in a draft is not a typo — it is a false claim, made under the byline of a
 * project whose whole argument is that its numbers can be checked.
 *
 * A test rather than a convention, because the convention already failed once.
 */
describe("draftProblems", () => {
  it("passes a draft that uses tokens", () => {
    expect(draftProblems("It holds {{RESPONSES}}, {{COUNT:BE}} from Belgium.")).toEqual([]);
  });

  it("catches a count typed back into the prose", () => {
    const problems = draftProblems("It holds zero responses. {{RESPONSES}}");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("states a count in prose");
  });

  it("catches a count typed back in any language a draft uses", () => {
    for (const prose of [
      "null Antworten",
      "zéro réponse",
      "cero respuestas",
      "zero risposte",
      "zero respostas",
      "zero răspunsuri",
    ]) {
      expect(draftProblems(`{{RESPONSES}} ${prose}`)).not.toEqual([]);
    }
  });

  it("catches a draft that says nothing about where the survey stands", () => {
    expect(draftProblems("Here is a survey.").join()).toContain("states no count at all");
  });

  it("catches a language directive nothing can render", () => {
    expect(draftProblems("<!-- outreach-lang: sv -->{{RESPONSES}}").join()).toContain("sv");
  });
});

/**
 * The real drafts, when they are present.
 *
 * `outreach/` is gitignored — the per-subreddit drafts are working copy, not
 * something to publish in the repo the posts link to — so this runs on the
 * machine that will actually post and is skipped in CI. That is why the guard
 * itself is a plain function tested above, and why `pnpm outreach` refuses to
 * render a draft it rejects: the check has to exist where the files do.
 */
const posts = findDrafts(OUTREACH_DIR).map((d) => ({ name: d.name, body: readDraft(d) }));

describe.skipIf(posts.length === 0)("the drafts on this machine", () => {
  it("are all there", () => {
    expect(posts.length).toBeGreaterThan(20);
  });

  it.each(posts)("$name is safe to post", ({ body }) => {
    expect(draftProblems(body)).toEqual([]);
  });

  it.each(posts)("$name leaves no token unfilled", ({ body }) => {
    expect(fillOutreachTokens(body, stats([country("Belgium", 4)], 9)).unknown).toEqual([]);
  });
});
