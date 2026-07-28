import { count } from "@/lib/format";
import { POPULATION_LABELS, type CountryRow } from "@/lib/stats";
import { publishMinFor, untilPublish } from "@/lib/thresholds";

/**
 * Which figures are nearest to publishing.
 *
 * The empty explorer is a dead end: it tells someone there is nothing for
 * their slice and stops there. This turns the same fact into the reason their
 * answer matters, and points at one country rather than scattering effort
 * across twenty-seven — the argument the confirmation screen already makes,
 * made to people who have not answered yet.
 *
 * A row is a country *and a population*, because those publish separately and
 * on different thresholds. Listing only the employee gap, as this did while
 * employees were the headline, hid the fact that a country's contractor rates
 * are often the shorter walk: twenty-five answers rather than sixty.
 *
 * Renders nothing until responses exist, so it is dormant during the cold
 * start and switches itself on, the same way `hasPublishedFigures` gates the
 * seeding copy.
 */
export function CountryProgress({ countries }: { countries: readonly CountryRow[] }) {
  if (countries.length === 0) return null;

  return (
    <section className="mt-16 border-t border-line pt-8">
      <h2 className="text-lg">Closest to publishing</h2>
      <p className="mt-3 max-w-[56ch] text-xs leading-relaxed text-ink-2">
        Each group publishes on its own count. Salaries need {publishMinFor("employee")} answers
        before a median means anything; contractor day rates need{" "}
        {publishMinFor("contractor")}, because a day rate is a single negotiated price with none
        of the bonus, equity and thirteenth-month variance a salary carries.
      </p>

      {/* Matched to the paragraph above rather than the full container: a
          60-response bar stretched across 1080px makes every country look
          equally far away. */}
      <ul className="mt-6 flex max-w-[46rem] flex-col gap-5">
        {countries.map((row) => {
          const threshold = publishMinFor(row.population);
          const words = POPULATION_LABELS[row.population];
          return (
            <li key={`${row.population}-${row.code}`} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
                <span className="font-semibold text-ink">
                  {row.name}
                  <small className="ml-2 text-2xs font-normal tracking-wide text-ink-3">
                    {words.short}
                  </small>
                </span>
                <span className="text-ink-3">
                  {count(row.responses)} of {threshold},{" "}
                  {count(untilPublish(row.population, row.responses))} to go
                </span>
              </div>
              <div
                className="h-1 overflow-hidden rounded-full bg-track"
                role="progressbar"
                aria-valuenow={row.responses}
                aria-valuemin={0}
                aria-valuemax={threshold}
                aria-label={`${row.name}, ${words.short.toLowerCase()}, ${row.responses} of ${threshold} answers`}
              >
                <div
                  className="h-full rounded-full bg-coral"
                  style={{ width: `${Math.min(100, (row.responses / threshold) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
