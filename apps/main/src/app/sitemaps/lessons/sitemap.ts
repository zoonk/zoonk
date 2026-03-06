import { SITEMAP_BATCH_SIZE } from "@/data/sitemaps/courses";
import { countSitemapLessons, listSitemapLessons } from "@/data/sitemaps/lessons";
import { SITE_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

export async function generateSitemaps() {
  const count = await countSitemapLessons();
  const pages = Math.ceil(count / SITEMAP_BATCH_SIZE);
  return Array.from({ length: Math.max(pages, 1) }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const lessons = await listSitemapLessons(id);

  return lessons.map(({ brandSlug, chapterSlug, courseSlug, lessonSlug, updatedAt }) => ({
    lastModified: updatedAt,
    url: `${SITE_URL}/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
  }));
}
