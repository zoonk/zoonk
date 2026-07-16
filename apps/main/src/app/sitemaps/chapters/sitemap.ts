import { countSitemapChapters, listSitemapChapters } from "@/data/sitemaps/chapters";
import { SITEMAP_BATCH_SIZE } from "@/data/sitemaps/courses";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { type MetadataRoute } from "next";

export async function generateSitemaps() {
  const count = await countSitemapChapters();
  const pages = Math.ceil(count / SITEMAP_BATCH_SIZE);
  return Array.from({ length: Math.max(pages, 1) }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const chapters = await listSitemapChapters(id);

  return chapters.map(({ brandSlug, chapterSlug, courseSlug, language, updatedAt }) => ({
    lastModified: updatedAt,
    url: getLocalizedUrl({ href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`, language }),
  }));
}
