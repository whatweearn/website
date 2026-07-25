/**
 * Confirms the two databases are genuinely two databases.
 *
 *   pnpm verify:separation
 *
 * Run before every deploy that touches connection strings. A copy-paste during
 * a hurried deploy is all it takes to point both at one instance, and nothing
 * else in the system would notice: every test would still pass and the site
 * would carry on telling people their email cannot be linked to their answers.
 */

import { verifySeparation } from "../src/lib/verifySeparation";

const result = verifySeparation(process.env.DATABASE_URL, process.env.SUBSCRIBER_DATABASE_URL);

if (!result.ok) {
  console.error(`✗ ${result.reason}`);
  process.exit(1);
}

console.log("✓ responses and subscribers are on separate instances");
console.log(`    responses   ${result.responsesHost}`);
console.log(`    subscribers ${result.subscribersHost}`);
