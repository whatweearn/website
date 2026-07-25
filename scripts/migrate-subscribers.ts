/**
 * Applies subscriber-database migrations.
 *
 *   pnpm db:migrate:subscribers
 *
 * A separate script from `scripts/migrate.ts` on purpose. Sharing one would
 * mean a single module holding both connection strings, which is exactly the
 * boundary `src/lib/subscribers/boundary.test.ts` exists to protect.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  closeSubscriberDatabase,
  hasSubscriberDatabase,
  subscriberDb,
} from "../src/lib/subscribers/client";

const MIGRATIONS_DIR = join(process.cwd(), "db/subscribers");

async function main() {
  if (!hasSubscriberDatabase()) {
    throw new Error("SUBSCRIBER_DATABASE_URL is not set. See .env.example.");
  }

  const sql = subscriberDb();
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
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log(`applied ${file}`);
  }

  console.log(`subscribers schema up to date (${files.length} migration(s))`);
}

main()
  .catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => closeSubscriberDatabase());
