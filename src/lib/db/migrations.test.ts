import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The migrations and queries, run against real Postgres.
 *
 * PGlite is Postgres compiled to WebAssembly, so this executes the actual SQL
 * rather than asserting things about its text. Phase 3 shipped with this
 * untested because no database was reachable; leaving it that way would have
 * meant the storage layer's first real execution happened in production.
 */

const schema = readFileSync(join(process.cwd(), "db/migrations/0001_init.sql"), "utf8");

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(schema);
});

afterAll(async () => {
  await db.close();
});

const baseRow = {
  submitted_on: "2026-07-24",
  handle: "handle-a",
  country: "DE",
  contract_type: "permanent",
  level: "senior",
  base_salary: 78_000,
  currency: "EUR",
};

async function insert(overrides: Partial<typeof baseRow> = {}) {
  const row = { ...baseRow, ...overrides };
  return db.query(
    `INSERT INTO responses (submitted_on, handle, country, contract_type, level, base_salary, currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (handle, submitted_on) DO NOTHING
     RETURNING id`,
    [
      row.submitted_on,
      row.handle,
      row.country,
      row.contract_type,
      row.level,
      row.base_salary,
      row.currency,
    ],
  );
}

describe("migrations", () => {
  it("applies cleanly to an empty database", async () => {
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = tables.rows.map((r) => r.table_name).sort();
    expect(names).toContain("responses");
    expect(names).toContain("fx_rates");
    expect(names).toContain("anomaly_log");
  });

  it("is idempotent, so a re-run does not fail a deploy", async () => {
    await expect(db.exec(schema)).resolves.toBeDefined();
  });
});

describe("responses table", () => {
  it("accepts a minimal response", async () => {
    const result = await insert({ handle: "minimal" });
    expect(result.rows).toHaveLength(1);
  });

  it("enforces one response per handle per day", async () => {
    // The rule that matters: application-level checks lose to two browser
    // tabs submitting at once, a unique index does not.
    await insert({ handle: "dupe" });
    const second = await insert({ handle: "dupe", base_salary: 999_999 });
    expect(second.rows).toHaveLength(0);

    const count = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM responses WHERE handle = 'dupe'`,
    );
    expect(count.rows[0]!.n).toBe(1);
  });

  it("allows the same handle again on a different day", async () => {
    await insert({ handle: "returning", submitted_on: "2026-07-24" });
    const later = await insert({ handle: "returning", submitted_on: "2026-07-25" });
    expect(later.rows).toHaveLength(1);
  });

  it("refuses a negative salary at the database level", async () => {
    await expect(insert({ handle: "negative", base_salary: -1 })).rejects.toThrow();
  });

  it("stores submitted_on as a date, dropping any time component", async () => {
    // A timestamp here would undo the whole correlation defence in §4.
    const column = await db.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'responses' AND column_name = 'submitted_on'`,
    );
    expect(column.rows[0]!.data_type).toBe("date");
  });

  it("has no column that could hold an address or an email", async () => {
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'responses'`,
    );
    const names = columns.rows.map((r) => r.column_name);
    for (const forbidden of ["ip", "ip_address", "email", "user_agent", "employer"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("defaults flags to an empty array rather than null", async () => {
    await insert({ handle: "flags" });
    const row = await db.query<{ flags: string[] }>(
      `SELECT flags FROM responses WHERE handle = 'flags'`,
    );
    expect(row.rows[0]!.flags).toEqual([]);
  });
});

describe("aggregate query", () => {
  it("returns only rows that are neither superseded nor excluded", async () => {
    await insert({ handle: "live-1", country: "NL" });
    await insert({ handle: "excluded-1", country: "NL" });
    await db.query(`UPDATE responses SET excluded_reason = 'test' WHERE handle = 'excluded-1'`);

    const rows = await db.query<{ country: string }>(
      `SELECT country FROM responses
       WHERE superseded_by IS NULL AND excluded_reason IS NULL AND country = 'NL'`,
    );
    expect(rows.rows).toHaveLength(1);
  });
});

describe("fx_rates", () => {
  it("keeps one rate per currency per day and updates on conflict", async () => {
    await db.query(
      `INSERT INTO fx_rates (rate_date, currency, per_eur) VALUES ('2026-07-24', 'PLN', 4.2795)`,
    );
    await db.query(
      `INSERT INTO fx_rates (rate_date, currency, per_eur) VALUES ('2026-07-24', 'PLN', 4.3000)
       ON CONFLICT (rate_date, currency) DO UPDATE SET per_eur = EXCLUDED.per_eur`,
    );

    const rows = await db.query<{ per_eur: string }>(
      `SELECT per_eur FROM fx_rates WHERE rate_date = '2026-07-24' AND currency = 'PLN'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(Number(rows.rows[0]!.per_eur)).toBeCloseTo(4.3, 4);
  });

  it("refuses a non-positive rate, which would make conversion nonsense", async () => {
    await expect(
      db.query(`INSERT INTO fx_rates (rate_date, currency, per_eur) VALUES ('2026-07-24', 'BAD', 0)`),
    ).rejects.toThrow();
  });

  it("selects the newest rate per currency", async () => {
    await db.query(`
      INSERT INTO fx_rates (rate_date, currency, per_eur) VALUES
        ('2026-07-20', 'CHF', 0.90), ('2026-07-24', 'CHF', 0.95)
      ON CONFLICT DO NOTHING
    `);
    const rows = await db.query<{ currency: string; per_eur: string }>(
      `SELECT DISTINCT ON (currency) currency, per_eur FROM fx_rates
       WHERE currency = 'CHF' ORDER BY currency, rate_date DESC`,
    );
    expect(Number(rows.rows[0]!.per_eur)).toBeCloseTo(0.95, 4);
  });
});
