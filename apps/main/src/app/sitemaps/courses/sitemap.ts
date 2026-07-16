import {
  SITEMAP_BATCH_SIZE,
  countSitemapCourses,
  listSitemapCourses,
} from "@/data/sitemaps/courses";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { type MetadataRoute } from "next";

export async function generateSitemaps() {
  const count = await countSitemapCourses();
  const pages = Math.ceil(count / SITEMAP_BATCH_SIZE);
  return Array.from({ length: Math.max(pages, 1) }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const courses = await listSitemapCourses(id);

  return courses.map(({ brandSlug, courseSlug, language, updatedAt }) => ({
    lastModified: updatedAt,
    url: getLocalizedUrl({ href: `/b/${brandSlug}/c/${courseSlug}`, language }),
  }));
}
