import { countSitemapCourses } from "@/data/sitemaps/courses";
import { countSitemapLibraryChapters } from "@/data/sitemaps/library-chapters";
import { countSitemapLibraryLessons } from "@/data/sitemaps/library-lessons";
import { getSitemapPageIds } from "@/data/sitemaps/sitemap-pages";
import { SITE_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

function getSitemapUrls({ count, resource }: { count: number; resource: string }): string[] {
  return getSitemapPageIds(count).map((id) => `${SITE_URL}/sitemaps/${resource}/sitemap/${id}.xml`);
}

/**
 * Lists every sitemap page, since each holds 5,000 URLs and search engines
 * only find the pages robots.txt names. The lesson player is kept out of
 * crawls: public lesson pages hold the indexable part, and the player starts a
 * lesson for a learner.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [courses, libraryChapters, libraryLessons] = await Promise.all([
    countSitemapCourses(),
    countSitemapLibraryChapters(),
    countSitemapLibraryLessons(),
  ]);

  return {
    rules: {
      allow: "/",
      disallow: ["/auth/", "/learn/", "/*/learn/", "/login", "/*/login"],
      userAgent: "*",
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...getSitemapUrls({ count: courses, resource: "courses" }),
      ...getSitemapUrls({ count: libraryChapters, resource: "library-chapters" }),
      ...getSitemapUrls({ count: libraryLessons, resource: "library-lessons" }),
    ],
  };
}
