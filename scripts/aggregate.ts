/**
 * The nightly job.
 *
 * Reads every usable response, converts to euro at stored ECB rates, applies
 * trimming and suppression, and writes a single static file that the site
 * serves. Nothing queries the responses table at request time.
 *
 *   pnpm aggregate
 *
 * Publishing nightly rather than live is also the strongest anti-manipulation
 * measure available (CLAUDE.md §6): without immediate feedback, someone
 * submitting invented salaries cannot tell whether it moved anything.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { closeDatabase, hasDatabase } from "../src/lib/db/client";
import { loadAggregateRows, loadLatestRates, saveRates } from "../src/lib/db/responseRepository";
import { fetchEcbDaily } from "../src/lib/fx/ecb";
import { aggregate } from "../src/lib/stats/aggregate";
import { buildMicrodata, emptyMicrodata } from "../src/lib/stats/microdata";
import { loadMicrodataRows } from "../src/lib/db/responseRepository";
import { EMPTY_STATS, STATS_FILE } from "../src/lib/stats";

const DATASET_FILE = "public/whatweearn-dataset.csv";

async function main() {
  const outputPath = join(process.cwd(), STATS_FILE);
  await mkdir(dirname(outputPath), { recursive: true });

  const datasetPath = join(process.cwd(), DATASET_FILE);
  await mkdir(dirname(datasetPath), { recursive: true });

  if (!hasDatabase()) {
    // Writing the empty shape is the point: a build without a database must
    // still produce a file that says "nothing yet", never a stale one left
    // over from a previous run.
    await writeFile(outputPath, `${JSON.stringify(EMPTY_STATS, null, 2)}\n`);
    await writeFile(datasetPath, emptyMicrodata());
    console.log("No DATABASE_URL — wrote the empty pre-launch dataset.");
    return;
  }

  if (process.env.SKIP_FX_REFRESH !== "1") {
    try {
      const { date, rates } = await fetchEcbDaily();
      await saveRates(date, rates);
      console.log(`Stored ${Object.keys(rates).length} ECB rates for ${date}.`);
    } catch (error) {
      // Yesterday's rates move a median by a fraction of a percent. Failing
      // the whole run over a temporary outage would be the worse trade.
      console.warn(`ECB refresh failed, using stored rates: ${(error as Error).message}`);
    }
  }

  const [rows, microRows, rates] = await Promise.all([
    loadAggregateRows(),
    loadMicrodataRows(),
    loadLatestRates(),
  ]);
  const { stats, skipped } = aggregate(rows, rates);

  const dataset = buildMicrodata(microRows, rates);
  await writeFile(datasetPath, dataset.csv);

  stats.datasetRows = dataset.released;
  await writeFile(outputPath, `${JSON.stringify(stats, null, 2)}\n`);

  console.log(
    `Dataset: released ${dataset.released} rows, withheld ${dataset.withheld} for k-anonymity.`,
  );

  console.log(`Read ${rows.length} responses across ${stats.countriesCovered} countries.`);
  for (const { reason, count } of skipped) {
    console.log(`  excluded ${count} — ${reason}`);
  }
  console.log(
    `Published ${stats.countries.filter((c) => c.median !== null).length} country medians.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
