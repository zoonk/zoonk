import { type SitemapResource, getSitemapPageIds } from "@/data/sitemaps/sitemap-pages";
import { SITE_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

function getSitemapUrls(resource: SitemapResource): string[] {
  return getSitemapPageIds(resource).map(
    (id) => `${SITE_URL}/sitemaps/${resource}/sitemap/${id}.xml`,
  );
}

/**
 * Lists every sitemap page (`SITEMAP_PAGES`), since search engines only find the pages robots.txt
 * names. The lesson player is kept out of crawls: public lesson pages hold the indexable part, and
 * the player starts a lesson for a learner.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: ["/auth/", "/learn/", "/*/learn/", "/login", "/*/login"],
      userAgent: "*",
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...getSitemapUrls("courses"),
      ...getSitemapUrls("library-chapters"),
      ...getSitemapUrls("library-lessons"),
    ],
  };
}
