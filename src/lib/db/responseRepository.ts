import type { ResponseRepository, StoredResponse } from "../repository";
import type { AggregateRow } from "../stats/aggregate";
import { EMPLOYEE_CONTRACTS, MIN_FTE_PERCENT, type Population } from "../stats/populations";

import { db } from "./client";

/**
 * Postgres-backed responses.
 *
 * Note what never reaches a column: no address, no user agent, no email, and
 * no timestamp finer than a date. The `handle` is a one-way, same-day digest
 * that exists solely so a duplicate can be spotted before midnight.
 */
export class PostgresResponseRepository implements ResponseRepository {
  async save(record: StoredResponse): Promise<void> {
    const r = record.response;
    const sql = db();

    // ON CONFLICT DO NOTHING makes the duplicate rule the database's job.
    // Checking first and then inserting would leave a race between two tabs.
    await sql`
      INSERT INTO responses (
        submitted_on, handle, country, city, work_setup, pay_location_adjusted,
        contract_type, fte_percent, discipline, primary_language, level,
        years_experience, base_salary, currency, salary_period, payments_per_year,
        days_per_year, hours_per_year, bonus,
        equity_annual, company_stage, company_size, industry, flags
      ) VALUES (
        ${record.submittedOn}, ${record.handle}, ${r.country}, ${r.city ?? null},
        ${r.workSetup ?? null}, ${r.payLocationAdjusted ?? null},
        ${r.contractType}, ${r.ftePercent ?? null}, ${r.discipline ?? null},
        ${r.primaryLanguage ?? null}, ${r.level}, ${r.yearsExperience ?? null},
        ${r.baseSalary}, ${r.currency}, ${r.salaryPeriod ?? null},
        ${r.paymentsPerYear ?? null}, ${r.daysPerYear ?? null}, ${r.hoursPerYear ?? null},
        ${r.bonus ?? null}, ${r.equityAnnual ?? null}, ${r.companyStage ?? null},
        ${r.companySize ?? null}, ${r.industry ?? null}, ${record.flags}
      )
      ON CONFLICT (handle, submitted_on) DO NOTHING
    `;
  }

  /**
   * How many responses each population has in this country, right now.
   *
   * The three branches mirror {@link populationOf} exactly, because these are
   * the numbers the confirmation screen turns into "21 more and Italy's
   * contractor day rates publish". If the split here disagreed with the split
   * the nightly aggregation applies, the site would promise a publication the
   * aggregation then declines to make.
   *
   * Slightly optimistic in one direction: the aggregation also drops rows it
   * cannot annualise (a monthly figure with no payment count) or convert (no
   * exchange rate for the day). Both are rare, and neither is expressible here
   * without duplicating the conversion pipeline in SQL.
   */
  async countByPopulation(country: string): Promise<Record<Population, number>> {
    const sql = db();
    const employed = sql`contract_type = ANY(${sql.array([...EMPLOYEE_CONTRACTS])})`;
    const fullTime = sql`(fte_percent IS NULL OR fte_percent >= ${MIN_FTE_PERCENT})`;

    const rows = await sql<{ employee: number; part_time: number; contractor: number }[]>`
      SELECT
        count(*) FILTER (WHERE ${employed} AND ${fullTime})::int       AS employee,
        count(*) FILTER (WHERE ${employed} AND NOT ${fullTime})::int   AS part_time,
        count(*) FILTER (WHERE NOT ${employed})::int                   AS contractor
      FROM responses
      WHERE country = ${country}
        AND superseded_by IS NULL
        AND excluded_reason IS NULL
    `;

    const row = rows[0];
    return {
      employee: row?.employee ?? 0,
      part_time: row?.part_time ?? 0,
      contractor: row?.contractor ?? 0,
    };
  }

  async hasSubmittedToday(handle: string): Promise<boolean> {
    const sql = db();
    const rows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM responses
        WHERE handle = ${handle} AND submitted_on = CURRENT_DATE
      ) AS exists
    `;
    return rows[0]?.exists ?? false;
  }
}

/**
 * Column for every field the aggregation reads, checked by the compiler.
 *
 * `satisfies Record<keyof AggregateRow, string>` is the point of this object.
 * Migration 0002 added `salary_period` and its multipliers, updated
 * {@link loadMicrodataRows}, and missed the query below. Nothing complained:
 * the hand-written SELECT was cast to `AggregateRow[]`, which is an assertion
 * rather than a check, and `annualise()` treats a missing period as annual for
 * backward compatibility. Every monthly and daily response was therefore
 * valued at roughly a twelfth of its real figure, silently, for as long as the
 * column was missing.
 *
 * Adding a field to `AggregateRow` or `RateInput` now fails typecheck until it
 * is given a column here, so the reader cannot fall behind the schema again.
 */
const AGGREGATE_COLUMNS = {
  country: "country",
  level: "level",
  contractType: "contract_type",
  ftePercent: "fte_percent",
  baseSalary: "base_salary",
  salaryPeriod: "salary_period",
  paymentsPerYear: "payments_per_year",
  daysPerYear: "days_per_year",
  hoursPerYear: "hours_per_year",
  bonus: "bonus",
  equityAnnual: "equity_annual",
  currency: "currency",
} as const satisfies Record<keyof AggregateRow, string>;

/** `base_salary AS "baseSalary", …` — built from the map above, never by hand. */
export const AGGREGATE_SELECT_LIST = Object.entries(AGGREGATE_COLUMNS)
  .map(([alias, column]) => `${column} AS "${alias}"`)
  .join(", ");

export const AGGREGATE_WHERE = "superseded_by IS NULL AND excluded_reason IS NULL";

/** Every response the aggregation is allowed to consider. */
export async function loadAggregateRows(): Promise<AggregateRow[]> {
  const sql = db();
  // `unsafe` only in the sense that the text is not a tagged template. Every
  // part of it comes from the compile-time map above; no value from a request
  // reaches this string.
  return sql.unsafe<AggregateRow[]>(
    `SELECT ${AGGREGATE_SELECT_LIST} FROM responses WHERE ${AGGREGATE_WHERE}`,
  );
}

/** Most recent published rate for each currency, as units per euro. */
export async function loadLatestRates(): Promise<Record<string, number>> {
  const sql = db();
  const rows = await sql<{ currency: string; per_eur: string }[]>`
    SELECT DISTINCT ON (currency) currency, per_eur
    FROM fx_rates
    ORDER BY currency, rate_date DESC
  `;
  const table: Record<string, number> = { EUR: 1 };
  for (const row of rows) table[row.currency] = Number(row.per_eur);
  return table;
}

export async function saveRates(date: string, rates: Record<string, number>): Promise<void> {
  const sql = db();
  const values = Object.entries(rates).map(([currency, perEur]) => ({
    rate_date: date,
    currency,
    per_eur: perEur,
  }));
  if (values.length === 0) return;

  await sql`
    INSERT INTO ${sql("fx_rates")} ${sql(values, "rate_date", "currency", "per_eur")}
    ON CONFLICT (rate_date, currency) DO UPDATE SET per_eur = EXCLUDED.per_eur
  `;
}

/** Rows for the downloadable dataset, before disclosure control is applied. */
export async function loadMicrodataRows(): Promise<import("../stats/microdata").MicrodataRow[]> {
  const sql = db();
  return sql<import("../stats/microdata").MicrodataRow[]>`
    SELECT
      country,
      level,
      contract_type    AS "contractType",
      work_setup       AS "workSetup",
      discipline,
      company_size     AS "companySize",
      industry,
      years_experience AS "yearsExperience",
      base_salary      AS "baseSalary",
      salary_period    AS "salaryPeriod",
      payments_per_year AS "paymentsPerYear",
      days_per_year    AS "daysPerYear",
      hours_per_year   AS "hoursPerYear",
      bonus,
      equity_annual    AS "equityAnnual",
      currency
    FROM responses
    WHERE superseded_by IS NULL
      AND excluded_reason IS NULL
  `;
}
