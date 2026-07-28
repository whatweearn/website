import { NextResponse } from "next/server";

import { getRepository } from "@/lib/repository";
import { POPULATIONS } from "@/lib/stats/populations";
import { COUNTRIES } from "@/lib/survey/options";
import { isPublishable, publishMinFor, untilPublish } from "@/lib/thresholds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How close each of a country's populations is to publishing.
 *
 * Read live so the confirmation screen can include the response just made —
 * "47 more" is a call to action; "48 more, not counting yours" is a shrug.
 *
 * All three populations are returned rather than only the one the caller
 * belongs to, because the screen also has to be able to say what a country
 * looks like as a whole, and because a per-population endpoint would leak
 * which population the caller is in through the URL.
 *
 * Discloses nothing new: per-country response counts already appear on the
 * data page, including for populations below the threshold. Counts are not
 * figures, so there is nothing here for manipulation to chase.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("country");
  const country = COUNTRIES.find((c) => c.code === code);

  if (!country) {
    return NextResponse.json({ error: "Unknown country." }, { status: 400 });
  }

  const counts = await getRepository().countByPopulation(country.code);

  return NextResponse.json(
    {
      country: country.name,
      populations: Object.fromEntries(
        POPULATIONS.map((population) => [
          population,
          {
            responses: counts[population],
            remaining: untilPublish(population, counts[population]),
            threshold: publishMinFor(population),
            published: isPublishable(population, counts[population]),
          },
        ]),
      ),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
