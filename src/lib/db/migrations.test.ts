import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EMPLOYEE_CONTRACTS, MIN_FTE_PERCENT, populationOf } from "../stats/populations";
import { annualise } from "../survey/annualise";
import { AGGREGATE_SELECT_LIST, AGGREGATE_WHERE } from "./responseRepository";

/**
 * The migrations and queries, run against real Postgres.
 *
 * PGlite is Postgres compiled to WebAssembly, so this executes the actual SQL
 * rather than asserting things about its text. Phase 3 shipped with this
 * untested because no database was reachable; leaving it that way would have
 * meant the storage layer's first real execution happened in production.
 */

/**
 * Every migration, in order — not just the first.
 *
 * This read used to name `0001_init.sql` directly, so the test database was
 * missing everything 0002 added. That is a large part of why the aggregation
 * reader could go on ignoring `salary_period` unnoticed: a test that tried to
 * use the column would have failed for the wrong reason. Reading the directory
 * means a new migration joins the suite by existing.
 */
const MIGRATIONS_DIR = join(process.cwd(), "db/migrations");
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const schema = migrations
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");

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

describe("populations in SQL", () => {
  /**
   * The rule exists twice: in TypeScript for the nightly aggregation, and in
   * SQL for the live counts behind "21 more and Italy's contractor day rates
   * publish". This asserts the two agree on every combination, because the
   * failure is silent — the site makes a promise and the aggregation declines
   * to keep it.
   *
   * Deliberately compares against `populationOf` rather than hand-written
   * expected numbers, so adding a condition to the rule and forgetting the
   * query fails here.
   */
  const cases: { contractType: string; ftePercent: number | null }[] = [
    { contractType: "permanent", ftePercent: null },
    { contractType: "permanent", ftePercent: 100 },
    { contractType: "permanent", ftePercent: MIN_FTE_PERCENT },
    { contractType: "permanent", ftePercent: MIN_FTE_PERCENT - 1 },
    { contractType: "permanent", ftePercent: 50 },
    { contractType: "fixed_term", ftePercent: 100 },
    { contractType: "fixed_term", ftePercent: 60 },
    { contractType: "contractor", ftePercent: 100 },
    { contractType: "contractor", ftePercent: null },
    { contractType: "b2b", ftePercent: 100 },
  ];

  const COUNTRY = "ZZ";

  beforeAll(async () => {
    for (const [i, c] of cases.entries()) {
      await db.query(
        `INSERT INTO responses
           (submitted_on, handle, country, contract_type, fte_percent, level, base_salary, currency)
         VALUES ('2026-07-24', $1, $2, $3, $4, 'senior', 78000, 'EUR')`,
        [`eligibility-${i}`, COUNTRY, c.contractType, c.ftePercent],
      );
    }
  });

  it("splits the responses exactly as the aggregation does", async () => {
    const rows = await db.query<{ employee: number; part_time: number; contractor: number }>(
      `SELECT
         count(*) FILTER (WHERE contract_type = ANY($2)
                            AND (fte_percent IS NULL OR fte_percent >= $3))::int     AS employee,
         count(*) FILTER (WHERE contract_type = ANY($2)
                            AND NOT (fte_percent IS NULL OR fte_percent >= $3))::int AS part_time,
         count(*) FILTER (WHERE NOT (contract_type = ANY($2)))::int                  AS contractor
       FROM responses
       WHERE country = $1 AND superseded_by IS NULL AND excluded_reason IS NULL`,
      [COUNTRY, [...EMPLOYEE_CONTRACTS], MIN_FTE_PERCENT],
    );

    const expected = { employee: 0, part_time: 0, contractor: 0 };
    for (const c of cases) expected[populationOf(c)] += 1;

    expect(rows.rows[0]).toEqual(expected);
    // Guards the test itself: a split that put everything in one bucket would
    // satisfy the assertion above while proving nothing.
    for (const population of ["employee", "part_time", "contractor"] as const) {
      expect(expected[population]).toBeGreaterThan(0);
    }
  });

  it("accounts for every stored row, leaving none in no population at all", async () => {
    const stored = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM responses WHERE country = $1`,
      [COUNTRY],
    );
    expect(stored.rows[0]!.n).toBe(cases.length);
  });
});

describe("the aggregation's own SELECT", () => {
  /**
   * The compiler guarantees every `AggregateRow` field has a column name. It
   * cannot guarantee the column exists in the schema, or that a monthly figure
   * survives the trip and annualises correctly. This runs the real select list
   * against the real schema and pushes the result through `annualise`.
   *
   * Without this, the reader falling behind a migration is invisible:
   * `annualise` treats a missing period as annual, so a monthly salary becomes
   * an annual one, twelve times too small, with no error anywhere.
   */
  const COUNTRY = "YY";

  beforeAll(async () => {
    await db.query(
      `INSERT INTO responses
         (submitted_on, handle, country, contract_type, fte_percent, level,
          base_salary, currency, salary_period, payments_per_year)
       VALUES ('2026-07-24', 'agg-monthly', $1, 'permanent', 100, 'senior',
               5000, 'EUR', 'month', 12)`,
      [COUNTRY],
    );
  });

  it("selects every column the aggregation needs", async () => {
    const result = await db.query(
      `SELECT ${AGGREGATE_SELECT_LIST} FROM responses WHERE ${AGGREGATE_WHERE} AND country = $1`,
      [COUNTRY],
    );
    const row = result.rows[0] as Record<string, unknown>;
    for (const field of ["salaryPeriod", "paymentsPerYear", "daysPerYear", "hoursPerYear"]) {
      // `null` is a real answer; `undefined` means the column was not selected.
      expect(row[field], `${field} missing from the select list`).not.toBeUndefined();
    }
  });

  it("annualises a monthly salary to twelve months, not one", async () => {
    const result = await db.query(
      `SELECT ${AGGREGATE_SELECT_LIST} FROM responses WHERE ${AGGREGATE_WHERE} AND country = $1`,
      [COUNTRY],
    );
    const annual = annualise(result.rows[0] as never);
    expect(annual.ok).toBe(true);
    expect(annual.ok && annual.annual).toBe(60_000);
  });
});
