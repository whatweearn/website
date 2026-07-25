import postgres from "postgres";

/**
 * The responses database.
 *
 * There is a second, physically separate database for the subscriber list, and
 * it is reached through different credentials from a different module. **No
 * file may import both.** That separation is the anonymity boundary described
 * in CLAUDE.md §4; a single module holding both connections would make joining
 * them a two-line change.
 */

let client: postgres.Sql | undefined;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Migrations run on the direct endpoint when one is configured.
 *
 * Neon's pooler runs PgBouncer in transaction mode. Ordinary queries are fine
 * — it supports protocol-level prepared statements, so postgres.js needs no
 * special handling — but schema changes are long single transactions that
 * belong on a direct connection.
 */
export function migrationDb(): postgres.Sql {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    debug: false,
    // "already exists, skipping" is expected on a re-run and is not a failure.
    onnotice: () => {},
  });
}

export function db(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres instance.",
    );
  }
  client ??= postgres(url, {
    // Responses are written once and read in a nightly batch; a large pool
    // buys nothing and costs connections on a serverless platform.
    max: 5,
    idle_timeout: 20,
    // Never let the driver log statement parameters — they are survey answers.
    debug: false,
  });
  return client;
}

export async function closeDatabase(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
}
