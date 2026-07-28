import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getChapterCacheTag, getChapterRouteCacheTag, getCourseCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

type ChapterRouteParams = { brandSlug: string; chapterSlug: string; courseSlug: string };

/**
 * Caches one normalized public chapter route and tags every embedded resource
 * so changes to either the chapter or its course invalidate the result.
 */
async function getCachedChapter(params: ChapterRouteParams) {
  "use cache";
  cacheTag(getChapterRouteCacheTag(params));

  const chapter = await prisma.chapter.findFirst({
    include: { course: { include: { categories: true } } },
    where: getPublishedChapterWhere({
      chapterWhere: { slug: params.chapterSlug },
      courseWhere: {
        organization: { kind: "brand", slug: params.brandSlug },
        slug: params.courseSlug,
      },
    }),
  });

  if (chapter) {
    cacheTag(getChapterCacheTag(chapter.id), getCourseCacheTag(chapter.course.id));
  }

  return chapter;
}

/**
 * Loads the published chapter identified by its complete brand course route.
 * Normalizing before the cached boundary gives encoded and decoded route
 * values one cache entry while preserving the full publication hierarchy.
 */
export async function getChapter(params: ChapterRouteParams) {
  return getCachedChapter({
    brandSlug: decodeRouteParam(params.brandSlug),
    chapterSlug: decodeRouteParam(params.chapterSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
  });
}

export type ChapterWithDetails = NonNullable<Awaited<ReturnType<typeof getChapter>>>;
