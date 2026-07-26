import { count } from "@/lib/format";
import type { CountryRow } from "@/lib/stats";
import { COUNTRY_PUBLISH_MIN, responsesUntilPublish } from "@/lib/thresholds";

/**
 * Which countries are nearest to publishing.
 *
 * The empty explorer is a dead end: it tells someone there is nothing for
 * their slice and stops there. This turns the same fact into the reason their
 * answer matters, and points at one country rather than scattering effort
 * across twenty-seven — the argument the confirmation screen already makes,
 * made to people who have not answered yet.
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
        A country&rsquo;s figures publish at {COUNTRY_PUBLISH_MIN} responses from employees on
        full-time standard contracts. B2B, freelance and part-time answers are kept and get
        their own cut, but they do not count towards this one, because their gross is not
        comparable.
      </p>

      {/* Matched to the paragraph above rather than the full container: a
          60-response bar stretched across 1080px makes every country look
          equally far away. */}
      <ul className="mt-6 flex max-w-[46rem] flex-col gap-5">
        {countries.map((country) => (
          <li key={country.name} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
              <span className="font-semibold text-ink">{country.name}</span>
              <span className="text-ink-3">
                {count(country.responses)} of {COUNTRY_PUBLISH_MIN},{" "}
                {count(responsesUntilPublish(country.responses))} to go
              </span>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-track"
              role="progressbar"
              aria-valuenow={country.responses}
              aria-valuemin={0}
              aria-valuemax={COUNTRY_PUBLISH_MIN}
              aria-label={`${country.name}, ${country.responses} of ${COUNTRY_PUBLISH_MIN} responses`}
            >
              <div
                className="h-full rounded-full bg-coral"
                style={{
                  width: `${Math.min(100, (country.responses / COUNTRY_PUBLISH_MIN) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
