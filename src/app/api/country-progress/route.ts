import { NextResponse } from "next/server";

import { getRepository } from "@/lib/repository";
import { COUNTRIES } from "@/lib/survey/options";
import {
  COUNTRY_PUBLISH_MIN,
  DAY_RATE_PUBLISH_MIN,
  dayRatesUntilPublish,
  isDayRatePublishable,
  responsesUntilPublish,
} from "@/lib/thresholds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How close a country is to publishing.
 *
 * Read live so the confirmation screen can include the response just made —
 * "47 more" is a call to action; "48 more, not counting yours" is a shrug.
 *
 * Discloses nothing new: per-country response counts already appear on the
 * data page, including for countries below the threshold. Counts are not
 * figures, so there is nothing here for manipulation to chase.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("country");
  const country = COUNTRIES.find((c) => c.code === code);

  if (!country) {
    return NextResponse.json({ error: "Unknown country." }, { status: 400 });
  }

  const repository = getRepository();
  const [responses, dayRates] = await Promise.all([
    repository.countForCountry(country.code),
    repository.countDayRatesForCountry(country.code),
  ]);

  return NextResponse.json(
    {
      country: country.name,
      responses,
      remaining: responsesUntilPublish(responses),
      threshold: COUNTRY_PUBLISH_MIN,
      published: responses >= COUNTRY_PUBLISH_MIN,
      // The contractor cut has its own count and its own, lower threshold. A
      // contractor is absent from the headline count by design, so quoting
      // them only that one describes a figure they cannot move.
      dayRates,
      dayRatesRemaining: dayRatesUntilPublish(dayRates),
      dayRateThreshold: DAY_RATE_PUBLISH_MIN,
      dayRatesPublished: isDayRatePublishable(dayRates),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
