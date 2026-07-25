import postgres from "postgres";

/**
 * The subscriber database.
 *
 * A different instance from the one holding survey responses, reached with a
 * different credential. **No module may import both this and the responses
 * client** — that is the anonymity boundary, and `boundary.test.ts` fails the
 * build if anything crosses it.
 */

let client: postgres.Sql | undefined;

export function hasSubscriberDatabase(): boolean {
  return Boolean(process.env.SUBSCRIBER_DATABASE_URL);
}

/** See the note on the responses side: migrations want the direct endpoint. */
export function subscriberMigrationDb(): postgres.Sql {
  const url = process.env.SUBSCRIBER_DATABASE_URL_DIRECT ?? process.env.SUBSCRIBER_DATABASE_URL;
  if (!url) throw new Error("SUBSCRIBER_DATABASE_URL is not set. See .env.example.");
  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    debug: false,
    // "already exists, skipping" is expected on a re-run and is not a failure.
    onnotice: () => {},
  });
}

export function subscriberDb(): postgres.Sql {
  const url = process.env.SUBSCRIBER_DATABASE_URL;
  if (!url) {
    throw new Error(
      "SUBSCRIBER_DATABASE_URL is not set. It must point at a different database from DATABASE_URL.",
    );
  }
  client ??= postgres(url, {
    max: 3,
    idle_timeout: 20,
    // Statement parameters here are email addresses. Never log them.
    debug: false,
  });
  return client;
}

export async function closeSubscriberDatabase(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
}
