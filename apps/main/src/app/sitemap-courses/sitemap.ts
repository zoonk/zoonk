"use cache";

import {
  SITEMAP_BATCH_SIZE,
  countSitemapCourses,
  listSitemapCourses,
} from "@/data/sitemaps/courses";
import { cacheTagSitemap } from "@zoonk/utils/cache";
import { SITE_URL } from "@zoonk/utils/constants";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { type MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

export async function generateSitemaps() {
  cacheTag(cacheTagSitemap());
  cacheLife("weeks");

  const count = await countSitemapCourses();
  const pages = Math.ceil(count / SITEMAP_BATCH_SIZE);
  return Array.from({ length: Math.max(pages, 1) }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  cacheTag(cacheTagSitemap());
  cacheLife("weeks");

  const id = Number(await props.id);
  const courses = await listSitemapCourses(id);

  return courses.map(({ brandSlug, courseSlug, language, updatedAt }) => {
    const prefix = language === DEFAULT_LOCALE ? "" : `/${language}`;

    return {
      lastModified: updatedAt,
      url: `${SITE_URL}${prefix}/b/${brandSlug}/c/${courseSlug}`,
    };
  });
}
