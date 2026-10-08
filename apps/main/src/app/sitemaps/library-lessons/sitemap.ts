import {
  countSitemapLibraryLessons,
  listSitemapLibraryLessons,
} from "@/data/sitemaps/library-lessons";
import { getSitemapPageIds } from "@/data/sitemaps/sitemap-pages";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getLessonHref } from "@/lib/public/public-hrefs";
import { type MetadataRoute } from "next";

export async function generateSitemaps() {
  const pageIds = getSitemapPageIds(await countSitemapLibraryLessons());
  return pageIds.map((id) => ({ id }));
}

/**
 * One batch of shared Library lessons at their home placement, including
 * lessons whose content isn't written yet, with when each last changed.
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const lessons = await listSitemapLibraryLessons(id);

  return lessons.map(({ language, updatedAt, ...params }) => ({
    lastModified: updatedAt,
    url: getLocalizedUrl({ href: getLessonHref(params), language }),
  }));
}
