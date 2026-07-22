import "server-only";
import { getChapterCacheTag, getChapterRouteCacheTag, getCourseCacheTag } from "@/data/cache-tags";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { decodeRouteParam } from "../_utils/route-params";

/**
 * Caches a published chapter and its public course context briefly so metadata,
 * catalog pages, and social previews reuse one serializable lookup.
 */
export async function getChapter(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
}) {
  "use cache";

  const brandSlug = decodeRouteParam(params.brandSlug);
  const chapterSlug = decodeRouteParam(params.chapterSlug);
  const courseSlug = decodeRouteParam(params.courseSlug);
  cacheTag(getChapterRouteCacheTag({ brandSlug, chapterSlug, courseSlug }));

  const chapter = await prisma.chapter.findFirst({
    include: { course: { include: { categories: true } } },
    where: getPublishedChapterWhere({
      chapterWhere: { slug: chapterSlug },
      courseWhere: { organization: { kind: "brand", slug: brandSlug }, slug: courseSlug },
    }),
  });

  if (chapter) {
    cacheTag(getChapterCacheTag(chapter.id), getCourseCacheTag(chapter.course.id));
  }

  return chapter;
}

export type ChapterWithDetails = NonNullable<Awaited<ReturnType<typeof getChapter>>>;
