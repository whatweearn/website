import { count, euro } from "@/lib/format";
import type { DayRateRow } from "@/lib/stats";
import {
  COUNTRY_PUBLISH_MIN,
  DAY_RATE_PUBLISH_MIN,
  dayRatesUntilPublish,
} from "@/lib/thresholds";

/**
 * What contractors charge per day.
 *
 * Deliberately its own section rather than a filter on the salary explorer.
 * Contractors are excluded from the headline medians because their gross
 * carries their own social contributions, and until now that meant they
 * answered nine questions and saw nothing back. It is also the only honest
 * unit for them: annualising a day rate multiplies in how many days someone
 * happened to bill, so a median of annualised contractor income measures
 * utilisation as much as price.
 */
export function DayRates({ rows }: { rows: readonly DayRateRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-16 border-t border-line pt-8">
      <h2 className="text-lg">Contractor day rates</h2>
      <p className="mt-3 max-w-[56ch] text-xs leading-relaxed text-ink-2">
        Quoted per day, gross, in euro. Contractor and B2B only — an employee&rsquo;s day rate
        is not pricing the same thing, because a contractor&rsquo;s figure carries their own
        social contributions. These are the rates as given, never an annual salary divided by
        days billed: that would fold in how much someone worked, which is the one thing a day
        rate is free of.
      </p>
      <p className="mt-2 max-w-[56ch] text-xs leading-relaxed text-ink-3">
        A country publishes at {DAY_RATE_PUBLISH_MIN} rates rather than the{" "}
        {COUNTRY_PUBLISH_MIN} a salary median needs. A day rate is a single negotiated price,
        with no bonus, equity or part-time fraction in it, so the median settles on far fewer
        answers.
      </p>

      <div className="table-scroll mt-6 max-w-[46rem]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Country
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Rates
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Lower quartile
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Median
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Upper quartile
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-line">
                <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                  {row.name}
                </th>
                <td className="figure-num py-3 pr-4 text-right text-ink-2">
                  {count(row.responses)}
                </td>
                {row.median === null ? (
                  /* One cell across the three figures, saying what is missing
                     and how much. "Withheld" alone is a dead end. */
                  <td colSpan={3} className="py-3 text-right text-ink-3">
                    {count(dayRatesUntilPublish(row.responses))} more to publish
                  </td>
                ) : (
                  <>
                    <td className="figure-num py-3 pr-4 text-right text-ink-2">
                      {euro(row.p25 ?? 0)}
                    </td>
                    <td className="figure-num py-3 pr-4 text-right font-semibold text-ink">
                      {euro(row.median)}
                    </td>
                    <td className="figure-num py-3 text-right text-ink-2">
                      {euro(row.p75 ?? 0)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
