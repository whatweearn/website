/**
 * Applies SQL migrations in order, once each.
 *
 *   pnpm db:migrate
 *
 * Deliberately tiny. A migration framework would be more machinery than a
 * schema this size warrants, and plain SQL files stay readable to anyone
 * auditing what the project stores — which, for a survey that promises
 * anonymity, is a property worth protecting.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { closeDatabase, hasDatabase, migrationDb } from "../src/lib/db/client";

/**
 * Which database to migrate. The subscriber store has its own directory and
 * its own credential, and is migrated by `pnpm db:migrate:subscribers` — the
 * two must never be applied through the same connection.
 */
const TARGET = process.argv[2] === "subscribers" ? "subscribers" : "responses";
const MIGRATIONS_DIR = join(
  process.cwd(),
  TARGET === "subscribers" ? "db/subscribers" : "db/migrations",
);

async function main() {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }

  const sql = migrationDb();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
  );

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = await readFile(join(MIGRATIONS_DIR, file), "utf8");

    // Each migration runs in a transaction, so a failure half way leaves the
    // schema untouched rather than partially applied.
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log(`applied ${file}`);
  }

  console.log(`${TARGET} schema up to date (${files.length} migration(s))`);
}

main()
  .catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
