import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();
  return [
    { url: SITE_URL, lastModified: updated, priority: 1 },
    { url: `${SITE_URL}/data`, lastModified: updated, priority: 0.9 },
    { url: `${SITE_URL}/methodology`, lastModified: updated, priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: updated, priority: 0.4 },
  ];
}
