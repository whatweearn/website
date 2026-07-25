import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/legal";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing sensitive lives here, but crawling the survey wastes form
      // tokens and the confirmation pages are meaningless without a link.
      disallow: ["/api/", "/survey", "/subscribed"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
