import { SITEMAP_BATCH_SIZE } from "@/data/sitemaps/courses";
import { countSitemapLessons, listSitemapLessons } from "@/data/sitemaps/lessons";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { type MetadataRoute } from "next";

/**
 * Allocates at least one lesson sitemap so the robots entry remains valid even
 * before a deployment has any indexable lesson rows.
 */
export async function generateSitemaps() {
  const count = await countSitemapLessons();
  const pages = Math.ceil(count / SITEMAP_BATCH_SIZE);
  return Array.from({ length: Math.max(pages, 1) }, (_, i) => ({ id: i }));
}

/**
 * Serializes one batch of canonical, locale-aware public lesson URLs.
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const lessons = await listSitemapLessons(id);

  return lessons.map(({ brandSlug, chapterSlug, courseSlug, language, lessonSlug, updatedAt }) => ({
    lastModified: updatedAt,
    url: getLocalizedUrl({
      href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
      language,
    }),
  }));
}
