import { listSitemapLibraryChapters } from "@/data/sitemaps/library-chapters";
import { getSitemapPageIds } from "@/data/sitemaps/sitemap-pages";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { type MetadataRoute } from "next";

export function generateSitemaps() {
  return getSitemapPageIds("library-chapters").map((id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const chapters = await listSitemapLibraryChapters(id);

  return chapters.map(({ language, updatedAt, ...params }) => ({
    lastModified: updatedAt,
    url: getLocalizedUrl({ href: getChapterHref(params), language }),
  }));
}
