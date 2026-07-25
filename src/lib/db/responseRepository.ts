import type { ResponseRepository, StoredResponse } from "../repository";
import type { AggregateRow } from "../stats/aggregate";

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

  async countForCountry(country: string): Promise<number> {
    const sql = db();
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM responses
      WHERE country = ${country}
        AND superseded_by IS NULL
        AND excluded_reason IS NULL
    `;
    return rows[0]?.n ?? 0;
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

/** Every response the aggregation is allowed to consider. */
export async function loadAggregateRows(): Promise<AggregateRow[]> {
  const sql = db();
  return sql<AggregateRow[]>`
    SELECT
      country,
      level,
      contract_type    AS "contractType",
      fte_percent      AS "ftePercent",
      base_salary      AS "baseSalary",
      bonus,
      equity_annual    AS "equityAnnual",
      currency
    FROM responses
    WHERE superseded_by IS NULL
      AND excluded_reason IS NULL
  `;
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
