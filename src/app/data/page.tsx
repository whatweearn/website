import type { Metadata } from "next";
import Link from "next/link";

import { CountryProgress } from "@/components/CountryProgress";
import { DayRates } from "@/components/DayRates";
import { Explorer } from "@/components/Explorer";
import { SubscribeForm } from "@/components/SubscribeForm";
import { Container } from "@/components/ui";
import { count } from "@/lib/format";
import {
  countriesNearingPublication,
  dayRatesByCountry,
  getSiteStats,
  hasPublishedFigures,
} from "@/lib/stats";
import { COUNTRY_PUBLISH_MIN, MIN_CELL_SIZE } from "@/lib/thresholds";

export const metadata: Metadata = {
  title: "The data",
  description:
    "Median total compensation for software engineers in Europe, by country and level. Open data, CC BY 4.0.",
  alternates: { canonical: "/data" },
};

export default async function DataPage() {
  const stats = await getSiteStats();
  const published = hasPublishedFigures(stats);

  return (
    <main className="py-[clamp(2rem,5vw,4rem)]">
      <Container>
        <Link href="/" className="text-xs text-ink-3 no-underline transition-colors hover:text-ink">
          <span aria-hidden="true">←</span> whatweearn
        </Link>

        <h1 className="mt-8 max-w-[16ch] text-2xl tracking-[-0.034em]">What engineers earn.</h1>
        {/* Gated on whether anything has *published*, not on whether anyone has
            answered. Those stopped being the same thing the moment the first
            response arrived: with responses in hand but every slice still under
            the threshold, "Built from 9 responses" reads as though there are
            figures to look at, and there are none. The landing page has always
            drawn this line with `hasPublishedFigures`; this page had not. */}
        <p className="mt-3 max-w-[52ch] text-ink-2">
          {published
            ? `Built from ${count(stats.totalResponses)} responses across ${count(stats.countriesCovered)} countries. Rebuilt nightly.`
            : stats.totalResponses === 0
              ? "Nothing is published yet. The first figures appear once a slice clears the threshold below."
              : `${count(stats.totalResponses)} responses so far, across ${count(stats.countriesCovered)} countries. Nothing is published yet — the first figures appear once a slice clears the threshold below.`}
        </p>

        <div className="mt-10">
          <Explorer stats={stats} />
        </div>

        <DayRates rows={dayRatesByCountry(stats)} />

        <CountryProgress countries={countriesNearingPublication(stats)} />

        <section className="mt-16 border-t border-line pt-8">
          <h2 className="text-lg">Take the whole thing</h2>
          <p className="mt-3 max-w-[56ch] text-xs leading-relaxed text-ink-2">
            The dataset is CC BY 4.0. Every combination of country, level, contract, discipline,
            company size, industry and experience band that appears fewer than {MIN_CELL_SIZE}{" "}
            times is withheld, cities are dropped entirely, experience is banded and pay is
            rounded to the nearest €500. That is what makes per-response rows publishable at all
            — a raw row is a cut of one, and releasing them verbatim would break the same
            promise the {COUNTRY_PUBLISH_MIN}-response rule keeps.
          </p>

          {stats.datasetRows ? (
            <a
              href="/whatweearn-dataset.csv"
              download
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-line-2 px-5 py-3 text-xs font-semibold text-ink no-underline transition-colors hover:bg-tint"
            >
              Download CSV
              <span className="font-normal text-ink-3">
                {count(stats.datasetRows)} rows
              </span>
            </a>
          ) : (
            <p className="mt-6 text-xs text-ink-3">
              The download appears once there are enough responses to release any rows.
            </p>
          )}
        </section>

        <section className="mt-16 border-t border-line pt-8">
          <SubscribeForm />
        </section>
      </Container>
    </main>
  );
}
