/**
 * Copies the local environment into Vercel.
 *
 * Vercel does not read `.env.local` — it has its own store, and any variable
 * missing or malformed there is a production-only failure. This exists so that
 * set is never assembled by hand.
 *
 * ## Why this is not a shell script
 *
 * It was one, and it shipped four broken values. `.env.local` writes the
 * connection strings as
 *
 *     DATABASE_URL='postgresql://…'    # responses, pooled
 *
 * and a `while IFS='=' read` loop takes everything after the first `=`
 * verbatim: the single quotes and the trailing comment travel with the value.
 * Vercel stored them happily, and the first submission on the live site died in
 * `new URL()` with `ERR_INVALID_URL`.
 *
 * Quoting and comment rules are a real grammar, so this uses Node's own dotenv
 * parser — the same one that reads the file in development. If a value works
 * locally it now transfers exactly, which was the entire point of scripting it.
 *
 *   pnpm dlx tsx scripts/vercel-env.ts            # production
 *   pnpm dlx tsx scripts/vercel-env.ts --preview  # preview
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const target = process.argv.includes("--preview") ? "preview" : "production";

/**
 * Values that must not be copied verbatim.
 *
 * `NEXT_PUBLIC_SITE_URL` is localhost locally. Shipping that is how every
 * confirmation link in every inbox ends up pointing at the recipient's own
 * machine — which has happened here once already.
 *
 * `NEXT_PUBLIC_SOURCE_URL` is absent locally, and the privacy page links to the
 * source to support the claim that the code is open.
 */
const OVERRIDES: Record<string, string> = {
  NEXT_PUBLIC_SITE_URL: "https://whatweearn.eu",
  NEXT_PUBLIC_SOURCE_URL: "https://github.com/whatweearn/website",
};

/** `vercel link` writes VERCEL_OIDC_TOKEN here; it is short-lived and injected. */
const SKIP = /^VERCEL_/;

function parseEnvFile(path: string): Record<string, string> {
  // Node's parser, not a regex of our own — quoting and comments are a grammar.
  return parseEnv(readFileSync(path, "utf8")) as Record<string, string>;
}

function put(key: string, value: string): void {
  execFileSync("pnpm", ["dlx", "vercel@latest", "env", "add", key, target, "--force"], {
    input: value,
    stdio: ["pipe", "ignore", "ignore"],
  });
  console.log(`  ${key}`);
}

const parsed = parseEnvFile(".env.local");
const values = { ...parsed, ...OVERRIDES };

console.log(`Copying to ${target}:`);
for (const [key, value] of Object.entries(values)) {
  if (SKIP.test(key) || !value) continue;

  // A value that still carries its own quotes or a comment means the parse
  // went wrong; sending it would repeat the failure this file exists to stop.
  if (/^['"]|['"]$/.test(value) || /\s#\s/.test(value)) {
    throw new Error(`${key} looks unparsed: it still contains quotes or a comment`);
  }
  put(key, value);
}

console.log(`\nSet. Verify with:  pnpm dlx vercel@latest env ls ${target}`);
