import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cache } from "react";
import { decodeRouteParam } from "../_utils/route-params";

const cachedGetChapter = cache(async (brandSlug: string, courseSlug: string, chapterSlug: string) =>
  prisma.chapter.findFirst({
    include: { course: { include: { categories: true } } },
    where: getPublishedChapterWhere({
      chapterWhere: { slug: chapterSlug },
      courseWhere: { organization: { kind: "brand", slug: brandSlug }, slug: courseSlug },
    }),
  }),
);

export function getChapter(params: { brandSlug: string; chapterSlug: string; courseSlug: string }) {
  return cachedGetChapter(
    decodeRouteParam(params.brandSlug),
    decodeRouteParam(params.courseSlug),
    decodeRouteParam(params.chapterSlug),
  );
}

export type ChapterWithDetails = NonNullable<Awaited<ReturnType<typeof getChapter>>>;
