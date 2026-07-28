/**
 * The numbers an outreach post is allowed to state.
 *
 * Every draft in `outreach/reddit/` was written on the day the site launched,
 * when the honest count was zero, and each one said so in prose. That was true
 * for about a day. A post pasted from those drafts afterwards understates the
 * count, which is a strange way to get it wrong but not a harmless one: this
 * is a project whose entire pitch is that its numbers are checkable, posted to
 * subreddits where somebody will click through and check. Being caught
 * *under*counting still establishes that the drafts and the site disagree.
 *
 * So the drafts hold tokens rather than numbers, and this module fills them
 * from the same `stats.json` the site renders. There is no second source of
 * truth to drift, and a draft left in a drawer for three weeks is correct on
 * the day it is posted rather than on the day it was written.
 *
 * See CLAUDE.md §9 (Phase 7) and `outreach/reddit/README.md`.
 */

import type { SiteStats } from "../stats";
import type { Population } from "../stats/populations";
import { COUNTRIES } from "../survey/options";
import {
  COUNTRY_PUBLISH_MIN,
  DAY_RATE_PUBLISH_MIN,
  MIN_CELL_SIZE,
  publishMinFor,
  untilPublish,
} from "../thresholds";

/**
 * `{{NAME}}` or `{{NAME:BE}}`.
 *
 * The country argument is inline rather than declared in front matter so a
 * draft carries no state a reader has to look up, and so a file naming two
 * countries is expressible at all.
 */
const TOKEN = /\{\{([A-Z_]+)(?::([A-Z]{2}))?\}\}/g;

/**
 * `<!-- outreach-lang: de -->`, switching language from that point on.
 *
 * Positional rather than a per-file property because the eight native-language
 * drafts each carry an "English reference — do not post" block for a
 * moderator's benefit, and a file-wide setting would render "9 Antworten" into
 * the middle of it. Per *token* tagging was the other option and is worse: it
 * is the kind of thing that gets half-applied.
 *
 * Directives are stripped from the rendered post, because an HTML comment
 * pasted into Reddit shows up as literal text.
 */
const LANG_DIRECTIVE = /[ \t]*<!--\s*outreach-lang:\s*([a-z]{2})\s*-->\n?/g;

export type FilledPost = {
  text: string;
  /** Tokens this module does not know, left verbatim in `text`. */
  unknown: string[];
};

const COUNTRY_NAMES: ReadonlyMap<string, string> = new Map(
  COUNTRIES.map((c) => [c.code, c.name]),
);

/**
 * How each language says "n responses" mid-sentence.
 *
 * These posts are hand-written in their target language, so a templated count
 * has to agree with the sentence around it. Getting that wrong is precisely
 * the tell that a post was generated rather than written, in the subreddits
 * where that judgement is harshest.
 *
 * Small numbers are spelled out because "0 responses" reads like a broken
 * template where "zero responses" reads like a person being straight with
 * you, and the second thing is the entire point of these posts.
 *
 * Like `CONTRACT_LOCAL_TERMS` in `src/lib/survey/options.ts`, these are
 * researched rather than authoritative and want a native speaker's read
 * (CLAUDE.md §11). Unlike those, a wrong form here is visible to the reader
 * and corrupts nothing downstream.
 */
const PHRASES: Record<string, (n: number) => string> = {
  en: (n) => (n === 0 ? "zero responses" : n === 1 ? "one response" : `${n} responses`),
  de: (n) => (n === 0 ? "null Antworten" : n === 1 ? "eine Antwort" : `${n} Antworten`),
  // French takes the singular after "zéro".
  fr: (n) => (n === 0 ? "zéro réponse" : n === 1 ? "une réponse" : `${n} réponses`),
  es: (n) => (n === 0 ? "cero respuestas" : n === 1 ? "una respuesta" : `${n} respuestas`),
  it: (n) => (n === 0 ? "zero risposte" : n === 1 ? "una risposta" : `${n} risposte`),
  pt: (n) => (n === 0 ? "zero respostas" : n === 1 ? "uma resposta" : `${n} respostas`),
  // Polish: the nominative plural (2–4) and the genitive plural (5+) of
  // "odpowiedź" are both "odpowiedzi", so one plural form covers everything
  // above one.
  pl: (n) => (n === 0 ? "zero odpowiedzi" : n === 1 ? "jedna odpowiedź" : `${n} odpowiedzi`),
  // Romanian inserts "de" before the noun once the last two digits reach 20:
  // 19 răspunsuri, but 20 de răspunsuri, and 101 răspunsuri again.
  ro: (n) => {
    if (n === 0) return "zero răspunsuri";
    if (n === 1) return "un răspuns";
    const tail = n % 100;
    return tail === 0 || tail >= 20 ? `${n} de răspunsuri` : `${n} răspunsuri`;
  },
};

/**
 * The same count with the noun left off, for the second half of a sentence
 * that has already named it: "9 responses across Europe, none from Germany".
 *
 * Repeating the noun is what produced "davon null Antworten aus Deutschland",
 * which is the register of a form letter rather than someone posting to their
 * own national subreddit. Gender follows the noun each language uses for a
 * response: feminine in fr/es/it/pt, masculine in ro.
 */
const BARE: Record<string, (n: number) => string> = {
  en: (n) => (n === 0 ? "none" : n === 1 ? "one" : String(n)),
  de: (n) => (n === 0 ? "keine" : n === 1 ? "eine" : String(n)),
  fr: (n) => (n === 0 ? "aucune" : n === 1 ? "une" : String(n)),
  es: (n) => (n === 0 ? "ninguna" : n === 1 ? "una" : String(n)),
  it: (n) => (n === 0 ? "nessuna" : n === 1 ? "una" : String(n)),
  pt: (n) => (n === 0 ? "nenhuma" : n === 1 ? "uma" : String(n)),
  pl: (n) => (n === 0 ? "żadnej" : n === 1 ? "jedna" : String(n)),
  ro: (n) => (n === 0 ? "niciunul" : n === 1 ? "unul" : String(n)),
};

export const OUTREACH_LANGUAGES = Object.keys(PHRASES);

/**
 * Every language a draft asks for, in the order it asks.
 *
 * Empty for the English drafts, which declare nothing. Used by the guard test
 * to reject a directive naming a language {@link PHRASES} cannot render — that
 * would otherwise fail open into English, silently, inside a Romanian post.
 */
export function declaredLanguages(markdown: string): string[] {
  return [...markdown.matchAll(LANG_DIRECTIVE)].map((m) => m[1]);
}

/**
 * Responses for one country, in one population.
 *
 * Deliberately per population rather than a raw submission count, because that
 * is what the publication thresholds are applied to. A post saying "Poland is
 * at 40" when 40 is the raw number and 26 of those are B2B promises a
 * publication the aggregation will then decline to make.
 *
 * Matching is by country code rather than by name: `stats.json` carries the
 * code since populations landed, and a name match silently returned zero for
 * any country the survey and the aggregation spelled differently.
 *
 * A country absent from `stats.json` has none in that population, which is
 * zero rather than an error: the aggregation only emits what it has seen.
 */
export function countryResponsesIn(
  stats: SiteStats,
  code: string,
  population: Population,
): number {
  if (!COUNTRY_NAMES.has(code)) return 0;
  return (
    stats.countries.find((c) => c.code === code && c.population === population)?.responses ?? 0
  );
}

/**
 * Salaried responses for one country, which is what `{{RESPONSES:PL}}` means.
 *
 * Employees only, so it agrees with {@link COUNTRY_PUBLISH_MIN}. Part-timers
 * publish against the same bar but in their own cut, and folding them in here
 * would overstate how close a country's salary median is.
 */
export function countryResponses(stats: SiteStats, code: string): number {
  return countryResponsesIn(stats, code, "employee");
}

/**
 * Day rates quoted for one country.
 *
 * A separate population from {@link countryResponses} and a separate threshold,
 * because the unit is different: these are euro per day, and
 * {@link DAY_RATE_PUBLISH_MIN} is lower than {@link COUNTRY_PUBLISH_MIN} for
 * the statistical reason set out in `thresholds.ts`, not as a concession to low
 * volume. A post to a freelance sub is the one place that distinction is the
 * whole argument, so it gets its own tokens rather than being approximated.
 */
export function countryDayRates(stats: SiteStats, code: string): number {
  return countryResponsesIn(stats, code, "contractor");
}

/** A count as it appears mid-sentence, in the post's own language. */
export function phraseCount(n: number, lang = "en"): string {
  return (PHRASES[lang] ?? PHRASES.en)(n);
}

/** The same count with the noun left off. See {@link BARE}. */
export function bareCount(n: number, lang = "en"): string {
  return (BARE[lang] ?? BARE.en)(n);
}

/** Fill every known token in a draft. Unknown tokens are reported, not thrown. */
export function fillOutreachTokens(markdown: string, stats: SiteStats): FilledPost {
  const unknown: string[] = [];
  let lang = "en";

  const fill = (segment: string): string =>
    segment.replace(TOKEN, (match, name: string, code?: string) => {
      switch (name) {
        case "RESPONSES":
          return phraseCount(
            code === undefined ? stats.totalResponses : countryResponses(stats, code),
            lang,
          );
        case "COUNT":
          if (code === undefined) break;
          return bareCount(countryResponses(stats, code), lang);
        case "NEEDS":
          if (code === undefined) break;
          return String(untilPublish("employee", countryResponses(stats, code)));
        case "DAY_RATES":
          if (code === undefined) break;
          return String(countryDayRates(stats, code));
        case "DAY_RATES_NEEDED":
          if (code === undefined) break;
          return String(untilPublish("contractor", countryDayRates(stats, code)));
        case "DAY_RATE_MIN":
          return String(DAY_RATE_PUBLISH_MIN);
        case "PUBLISH_MIN":
          return String(COUNTRY_PUBLISH_MIN);
        case "MIN_CELL":
          return String(MIN_CELL_SIZE);
      }
      unknown.push(match);
      return match;
    });

  // Walk the directives in order, rendering each stretch of text in whatever
  // language was last declared, and dropping the directives themselves.
  let text = "";
  let cursor = 0;
  for (const directive of markdown.matchAll(LANG_DIRECTIVE)) {
    text += fill(markdown.slice(cursor, directive.index));
    lang = directive[1] in PHRASES ? directive[1] : "en";
    cursor = directive.index + directive[0].length;
  }

  return { text: text + fill(markdown.slice(cursor)), unknown };
}

/**
 * Ways a draft can state a count that `stats.json` will later contradict.
 *
 * The failure this catches is not hypothetical: every draft was written on
 * launch day saying "zero responses", in six languages, and stayed that way
 * while the count moved. Numbers in these posts belong in tokens.
 *
 * Deliberately a list of the phrasings that actually occurred rather than an
 * attempt at a general "is this a number" rule, which would flag the
 * thresholds the posts are supposed to quote. The real guarantee comes from
 * the companion check that a draft contains a `{{RESPONSES}}` token at all.
 */
const FROZEN_COUNT = [
  /\bzero responses?\b/i,
  /\bno responses\b/i,
  /\bhas zero\b/i,
  /\bnull Antworten\b/i,
  /\bzéro réponses?\b/i,
  /\bcero respuestas\b/i,
  /\bzero risposte\b/i,
  /\bzero respostas\b/i,
  /\bzero răspunsuri\b/i,
  /\bzero odpowiedzi\b/i,
];

/**
 * `<!-- outreach-standalone -->`, marking a post that links nothing.
 *
 * These exist because every high-reach channel gates on contributor standing
 * and this project has none, so the only route back into Reddit is posts that
 * are worth reading without the link (CLAUDE.md §9, `outreach/README.md`). A
 * standalone post must **not** state where the survey stands, since quoting
 * your own project's numbers is the thing that makes a post promotional.
 *
 * It is a marker rather than a filename convention because the rule it turns
 * off is a correctness rule, and those should be switched off explicitly and
 * visibly, in the file the reader is looking at.
 */
const STANDALONE = /<!--\s*outreach-standalone\s*-->/;

/** Whether a draft is a no-link post rather than something that pitches. */
export function isStandalone(markdown: string): boolean {
  return STANDALONE.test(markdown);
}

/**
 * What is wrong with a draft, if anything. Empty means it is safe to post.
 *
 * Lives here rather than only in the test because `outreach/` is gitignored —
 * the drafts are local, so CI never sees them and a test alone would be a
 * guard that runs everywhere except where the drafts are. `pnpm outreach`
 * calls this at the moment somebody is about to paste one.
 */
export function draftProblems(markdown: string): string[] {
  const problems = FROZEN_COUNT.filter((p) => p.test(markdown)).map(
    (p) => `states a count in prose (${p.source})`,
  );
  if (isStandalone(markdown)) {
    // The inverse rule: a standalone post that quotes the project's own
    // numbers has stopped being standalone.
    if (/\{\{[A-Z_]+(:[A-Z]{2})?\}\}/.test(markdown)) {
      problems.push("is marked standalone but still states the survey's numbers");
    }
  } else if (!/\{\{RESPONSES(:[A-Z]{2})?\}\}/.test(markdown)) {
    problems.push("states no count at all, and every post that pitches says where it stands");
  }
  for (const lang of declaredLanguages(markdown)) {
    if (!(lang in PHRASES)) problems.push(`declares language "${lang}", which cannot be rendered`);
  }
  return problems;
}

/**
 * How the push is actually doing, in the one unit that decides anything.
 *
 * Total responses is the number that feels like progress and it is the wrong
 * one to steer by: the thresholds are *per country*, so 100 responses spread
 * across 20 countries publishes exactly nothing. The closest country is what
 * says whether the push is working, and it is the number the stopping rule in
 * `outreach/reddit/README.md` is written against.
 *
 * Ranked by **share of its own threshold**, not by raw count, because since
 * populations landed the thresholds differ by population: 20 contractor day
 * rates are five short of {@link DAY_RATE_PUBLISH_MIN} while 20 salaries are
 * forty short of {@link COUNTRY_PUBLISH_MIN}. Sorting on the raw number would
 * report the second as the better position when it is much the worse one, and
 * would point the next post at the wrong country. Same rule as `/data`'s
 * "closest to publishing", for the same reason.
 */
export function bestCountry(
  stats: SiteStats,
): { name: string; population: Population; responses: number; needs: number } | null {
  const share = (row: { population: Population; responses: number }) =>
    row.responses / publishMinFor(row.population);

  const top = [...stats.countries].sort(
    (a, b) => share(b) - share(a) || b.responses - a.responses || a.name.localeCompare(b.name),
  )[0];

  return top === undefined || top.responses === 0
    ? null
    : {
        name: top.name,
        population: top.population,
        responses: top.responses,
        needs: untilPublish(top.population, top.responses),
      };
}
