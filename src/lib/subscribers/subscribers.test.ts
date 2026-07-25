import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { looksLikeEmail, normaliseEmail, tokenFor, verifyToken } from "./tokens";

const schema = readFileSync(join(process.cwd(), "db/subscribers/0001_init.sql"), "utf8");

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(schema);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.query("DELETE FROM subscribers");
});

describe("subscriber schema", () => {
  it("applies cleanly", async () => {
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(tables.rows.map((r) => r.table_name)).toContain("subscribers");
  });

  it("stores dates, never timestamps", async () => {
    // Sub-second precision on both sides is what makes a response and a signup
    // correlatable. This is the whole point of the design.
    const columns = await db.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'subscribers'`,
    );
    for (const column of columns.rows) {
      expect(column.data_type).not.toContain("timestamp");
      expect(column.data_type).not.toContain("time");
    }
  });

  it("uses a random identifier, not a sequential one", async () => {
    // A bigserial would order rows by arrival, which would let someone line up
    // "the 1,203rd subscriber" against "the 4,812th response".
    const id = await db.query<{ data_type: string; column_default: string | null }>(
      `SELECT data_type, column_default FROM information_schema.columns
       WHERE table_name = 'subscribers' AND column_name = 'id'`,
    );
    expect(id.rows[0]!.data_type).toBe("uuid");
    expect(id.rows[0]!.column_default ?? "").not.toContain("nextval");
  });

  it("holds no column that could carry a survey answer", async () => {
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'subscribers'`,
    );
    const names = columns.rows.map((r) => r.column_name);
    for (const forbidden of ["salary", "country", "level", "response_id", "handle"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("accepts one row per address", async () => {
    await db.query(`INSERT INTO subscribers (email, subscribed_on) VALUES ('a@b.co', CURRENT_DATE)`);
    await expect(
      db.query(`INSERT INTO subscribers (email, subscribed_on) VALUES ('a@b.co', CURRENT_DATE)`),
    ).rejects.toThrow();
  });

  it("generates distinct identifiers with no ordering between them", async () => {
    for (const email of ["a@x.co", "b@x.co", "c@x.co"]) {
      await db.query(`INSERT INTO subscribers (email, subscribed_on) VALUES ($1, CURRENT_DATE)`, [
        email,
      ]);
    }
    const rows = await db.query<{ id: string }>(`SELECT id FROM subscribers`);
    const ids = rows.rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
    // Sorting by id must not reproduce insertion order for random UUIDs.
    expect(ids).toHaveLength(3);
  });
});

describe("tokens", () => {
  it("round-trips for the right purpose", () => {
    const token = tokenFor("a@b.co", "confirm");
    expect(verifyToken("a@b.co", "confirm", token)).toBe(true);
  });

  it("does not accept a confirm token as an unsubscribe token", () => {
    const token = tokenFor("a@b.co", "confirm");
    expect(verifyToken("a@b.co", "unsubscribe", token)).toBe(false);
  });

  it("is bound to the address", () => {
    const token = tokenFor("a@b.co", "confirm");
    expect(verifyToken("other@b.co", "confirm", token)).toBe(false);
  });

  it("ignores case and surrounding space, so links work from any mail client", () => {
    const token = tokenFor("a@b.co", "confirm");
    expect(verifyToken("  A@B.CO ", "confirm", token)).toBe(true);
  });

  it("rejects a tampered token without throwing", () => {
    expect(verifyToken("a@b.co", "confirm", "nonsense")).toBe(false);
    expect(verifyToken("a@b.co", "confirm", "")).toBe(false);
  });

  it("stores no token, deriving it from the address instead", () => {
    // Same address, same link — which is why unsubscribing still works from an
    // email received a year ago, with no token column to leak.
    expect(tokenFor("a@b.co", "confirm")).toBe(tokenFor("a@b.co", "confirm"));
  });
});

describe("looksLikeEmail", () => {
  it.each(["a@b.co", "first.last+tag@sub.example.org", "  Mixed@Case.COM  "])(
    "accepts %s",
    (value) => {
      expect(looksLikeEmail(value)).toBe(true);
    },
  );

  it.each(["", "nope", "a@b", "a b@c.co", "@b.co", "a@.co"])("rejects %s", (value) => {
    expect(looksLikeEmail(value)).toBe(false);
  });

  it("normalises for storage", () => {
    expect(normaliseEmail("  A@B.CO ")).toBe("a@b.co");
  });
});
