/**
 * Print an outreach draft with its numbers filled in, or the numbers alone.
 *
 *   pnpm outreach                          # the facts a post may state today
 *   pnpm outreach tier-2-Poland            # that post, ready to paste
 *
 * The drafts hold tokens instead of counts so that a post written three weeks
 * ago is true on the day it goes out. This is the thing that fills them. See
 * `src/lib/outreach/facts.ts` for why, and `outreach/reddit/README.md` for the
 * schedule the drafts are posted on.
 */

import { readFileSync } from "node:fs";

import {
  bestCountry,
  draftProblems,
  fillOutreachTokens,
  phraseCount,
} from "../src/lib/outreach/facts";
import { findDrafts } from "../src/lib/outreach/drafts";
import { STATS_FILE, type SiteStats, hasPublishedFigures } from "../src/lib/stats";
import { COUNTRY_PUBLISH_MIN, DAY_RATE_PUBLISH_MIN, MIN_CELL_SIZE } from "../src/lib/thresholds";

const DRAFTS = "outreach";

function loadStats(): SiteStats {
  return JSON.parse(readFileSync(STATS_FILE, "utf8")) as SiteStats;
}

/**
 * The status block.
 *
 * Leads with the country closest to publishing because that is the number the
 * push is actually steered by — the bars are per country, so a healthy-looking
 * total spread thin publishes nothing at all. "Closest" is share of the
 * relevant threshold rather than raw count, since the two populations do not
 * share one. See {@link bestCountry}.
 */
function printStatus(stats: SiteStats): void {
  const best = bestCountry(stats);

  console.log("Facts an outreach post may state today");
  console.log("─".repeat(56));
  console.log(`  Responses           ${phraseCount(stats.totalResponses)}`);
  console.log(
    `  Closest country     ${
      best === null
        ? "none yet"
        : `${best.name} ${best.population}, ${best.responses} (${best.needs} to publish)`
    }`,
  );
  console.log(`  Countries published ${hasPublishedFigures(stats) ? "see /data" : "none"}`);
  console.log(`  Salaries publish at ${COUNTRY_PUBLISH_MIN} per country`);
  console.log(`  Day rates publish at ${DAY_RATE_PUBLISH_MIN} per country`);
  console.log(`  Withheld below      ${MIN_CELL_SIZE} per cell`);
  console.log("");
  console.log("  Nothing beyond these. A post that states a figure the site");
  console.log("  does not show is the one mistake this project cannot make.");
}

function resolveDraft(name: string): string {
  const available = findDrafts(DRAFTS);
  const needle = name.toLowerCase().replace(/\.md$/, "");

  // Bare names are what anyone actually types: "UK", "Poland", "show-hn".
  const matches = available.filter((d) => d.name.toLowerCase().includes(needle));
  if (matches.length === 1) return matches[0].path;

  // An exact basename wins over a substring, so "UK" does not lose to "UKJobs".
  const exact = matches.filter((d) => {
    const base = (d.name.split("/").pop() ?? "").toLowerCase().replace(/\.md$/, "");
    return base === needle || base.endsWith(`-${needle}`);
  });
  if (exact.length === 1) return exact[0].path;

  console.error(
    matches.length === 0
      ? `No draft matching "${name}". Available:\n  ${available.map((d) => d.name).join("\n  ")}`
      : `"${name}" matches several drafts:\n  ${matches.map((d) => d.name).join("\n  ")}`,
  );
  process.exit(1);
}

const [name] = process.argv.slice(2);
const stats = loadStats();

if (name === undefined) {
  printStatus(stats);
} else {
  const path = resolveDraft(name);
  const draft = readFileSync(path, "utf8");

  // Refuses rather than warns, and refuses here rather than only in the test
  // suite, because `outreach/` is gitignored: this is the last point between a
  // draft that states a stale number and that number being posted in public.
  const problems = draftProblems(draft);
  if (problems.length > 0) {
    console.error(`${path} is not safe to post:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("\nSee outreach/reddit/README.md — counts belong in tokens.");
    process.exit(1);
  }

  const { text, unknown } = fillOutreachTokens(draft, stats);

  if (unknown.length > 0) {
    // Loud, and still prints the post: a token this script cannot fill is a
    // hole in the draft, and the person about to paste it is the one who has
    // to see it.
    console.error(`⚠ ${path} has tokens this script cannot fill: ${unknown.join(", ")}`);
    console.error("");
  }

  console.log(text);
}
