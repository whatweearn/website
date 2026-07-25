import { redirect } from "next/navigation";

import { SOURCE_URL } from "@/lib/legal";

/**
 * The footer promises the code is open; this is the shortest path to it.
 *
 * A redirect rather than a page so the link never goes stale if the
 * repository moves — one environment variable, one place.
 */
export function GET() {
  redirect(SOURCE_URL);
}
