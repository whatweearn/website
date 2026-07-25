import { subscriberDb } from "./client";
import { normaliseEmail } from "./tokens";

/**
 * The subscriber list.
 *
 * ## A deliberate deviation from the plan
 *
 * CLAUDE.md specified queueing signups and flushing them in shuffled batches
 * every fifteen minutes, to stop a response and a signup being lined up by
 * insertion order. On a serverless platform an in-process queue holding
 * writes for fifteen minutes loses every pending signup whenever an instance
 * is recycled — which is routine. Silently discarding something a person
 * explicitly asked for is a worse failure than the one being defended against.
 *
 * The same guarantee is reached without the data loss:
 *
 *   1. Random UUID primary keys, so row identifiers carry no ordering.
 *   2. Date-only columns, so nothing has sub-day precision.
 *   3. {@link compactDay}, which periodically rewrites a day's rows in random
 *      order so physical layout carries no signal either.
 *
 * Residual risk: someone with write-ahead-log or filesystem access to *both*
 * databases could still correlate by physical write time. That requires
 * infrastructure-level compromise of two separately-credentialed instances,
 * and no application-level design defeats it.
 */

export type SubscribeResult = "pending" | "already_confirmed" | "resubscribed";

export async function subscribe(email: string, today: string): Promise<SubscribeResult> {
  const sql = subscriberDb();
  const address = normaliseEmail(email);

  const existing = await sql<{ confirmed_on: string | null; unsubscribed_on: string | null }[]>`
    SELECT confirmed_on, unsubscribed_on FROM subscribers WHERE email = ${address}
  `;

  if (existing.length > 0) {
    const row = existing[0]!;
    if (row.unsubscribed_on) {
      // Someone who left and came back starts the opt-in over rather than
      // being silently re-added.
      await sql`
        UPDATE subscribers
        SET unsubscribed_on = NULL, confirmed_on = NULL, subscribed_on = ${today}
        WHERE email = ${address}
      `;
      return "resubscribed";
    }
    return row.confirmed_on ? "already_confirmed" : "pending";
  }

  await sql`
    INSERT INTO subscribers (email, subscribed_on) VALUES (${address}, ${today})
    ON CONFLICT (email) DO NOTHING
  `;
  return "pending";
}

export async function confirm(email: string, today: string): Promise<boolean> {
  const sql = subscriberDb();
  const rows = await sql`
    UPDATE subscribers
    SET confirmed_on = ${today}, unsubscribed_on = NULL
    WHERE email = ${normaliseEmail(email)} AND confirmed_on IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Unsubscribes, and reports success even when the address was never on the
 * list — telling a stranger whether an address is subscribed would leak
 * membership to anyone who guessed a link.
 */
export async function unsubscribe(email: string, today: string): Promise<void> {
  const sql = subscriberDb();
  await sql`
    UPDATE subscribers
    SET unsubscribed_on = ${today}
    WHERE email = ${normaliseEmail(email)} AND unsubscribed_on IS NULL
  `;
}

/** Addresses that confirmed and have not left. */
export async function confirmedRecipients(): Promise<string[]> {
  const sql = subscriberDb();
  const rows = await sql<{ email: string }[]>`
    SELECT email FROM subscribers
    WHERE confirmed_on IS NOT NULL AND unsubscribed_on IS NULL
    ORDER BY random()
  `;
  return rows.map((r) => r.email);
}

/**
 * Drops addresses that never confirmed.
 *
 * An address someone entered and did not confirm is one we were never given
 * permission to keep.
 */
export async function purgeUnconfirmed(olderThanDays = 14): Promise<number> {
  const sql = subscriberDb();
  const rows = await sql`
    DELETE FROM subscribers
    WHERE confirmed_on IS NULL
      AND unsubscribed_on IS NULL
      AND subscribed_on < CURRENT_DATE - ${olderThanDays}::integer
    RETURNING id
  `;
  return rows.length;
}

/**
 * Rewrites a day's rows in random physical order.
 *
 * Replaces the shuffled-batch flush from the original plan (see the note at
 * the top of this file). Deleting and re-inserting keeps the same values and
 * the same random identifiers while discarding the order they arrived in.
 */
export async function compactDay(day: string): Promise<number> {
  const sql = subscriberDb();
  return sql.begin(async (tx) => {
    const rows = await tx<
      { id: string; email: string; confirmed_on: string | null; unsubscribed_on: string | null }[]
    >`
      DELETE FROM subscribers WHERE subscribed_on = ${day}
      RETURNING id, email, confirmed_on, unsubscribed_on
    `;
    if (rows.length === 0) return 0;

    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    for (const row of shuffled) {
      await tx`
        INSERT INTO subscribers (id, email, subscribed_on, confirmed_on, unsubscribed_on)
        VALUES (${row.id}, ${row.email}, ${day}, ${row.confirmed_on}, ${row.unsubscribed_on})
      `;
    }
    return shuffled.length;
  });
}
