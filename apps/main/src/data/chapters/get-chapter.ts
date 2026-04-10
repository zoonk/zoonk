import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetChapter = cache(async (brandSlug: string, courseSlug: string, chapterSlug: string) =>
  prisma.chapter.findFirst({
    include: { course: true },
    where: getPublishedChapterWhere({
      chapterWhere: { slug: chapterSlug },
      courseWhere: {
        organization: { kind: "brand", slug: brandSlug },
        slug: courseSlug,
      },
    }),
  }),
);

export function getChapter(params: { brandSlug: string; chapterSlug: string; courseSlug: string }) {
  return cachedGetChapter(params.brandSlug, params.courseSlug, params.chapterSlug);
}

export type ChapterWithDetails = NonNullable<Awaited<ReturnType<typeof getChapter>>>;
