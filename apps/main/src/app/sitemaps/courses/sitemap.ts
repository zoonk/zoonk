import { countSitemapCourses, listSitemapCourses } from "@/data/sitemaps/courses";
import { getSitemapPageIds } from "@/data/sitemaps/sitemap-pages";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { type MetadataRoute } from "next";

export async function generateSitemaps() {
  const pageIds = getSitemapPageIds(await countSitemapCourses());
  return pageIds.map((id) => ({ id }));
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
