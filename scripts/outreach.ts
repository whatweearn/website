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

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  bestCountry,
  draftProblems,
  fillOutreachTokens,
  phraseCount,
} from "../src/lib/outreach/facts";
import { STATS_FILE, type SiteStats, hasPublishedFigures } from "../src/lib/stats";
import { COUNTRY_PUBLISH_MIN, MIN_CELL_SIZE, responsesUntilPublish } from "../src/lib/thresholds";

const DRAFTS = "outreach/reddit";

function loadStats(): SiteStats {
  return JSON.parse(readFileSync(STATS_FILE, "utf8")) as SiteStats;
}

/**
 * The status block.
 *
 * Leads with the best single country because that is the number the push is
 * actually steered by — {@link COUNTRY_PUBLISH_MIN} is a per-country bar, so a
 * healthy-looking total spread thin publishes nothing at all.
 */
function printStatus(stats: SiteStats): void {
  const best = bestCountry(stats);

  console.log("Facts an outreach post may state today");
  console.log("─".repeat(56));
  console.log(`  Responses           ${phraseCount(stats.totalResponses)}`);
  console.log(
    `  Best country        ${
      best === null
        ? "none yet"
        : `${best.name}, ${best.responses} (${responsesUntilPublish(best.responses)} to publish)`
    }`,
  );
  console.log(`  Countries published ${hasPublishedFigures(stats) ? "see /data" : "none"}`);
  console.log(`  Publishes at        ${COUNTRY_PUBLISH_MIN} per country`);
  console.log(`  Withheld below      ${MIN_CELL_SIZE} per cell`);
  console.log("");
  console.log("  Nothing beyond these. A post that states a figure the site");
  console.log("  does not show is the one mistake this project cannot make.");
}

function resolveDraft(name: string): string {
  const file = name.endsWith(".md") ? name : `${name}.md`;
  const available = readdirSync(DRAFTS).filter((f) => f.endsWith(".md"));

  const exact = available.find((f) => f === file);
  if (exact !== undefined) return join(DRAFTS, exact);

  // Bare country names are what anyone actually types.
  const matches = available.filter((f) => f.toLowerCase().includes(name.toLowerCase()));
  if (matches.length === 1) return join(DRAFTS, matches[0]);

  console.error(
    matches.length === 0
      ? `No draft matching "${name}". Available:\n  ${available.join("\n  ")}`
      : `"${name}" matches several drafts:\n  ${matches.join("\n  ")}`,
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
