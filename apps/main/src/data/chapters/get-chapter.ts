import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetChapter = cache(async (brandSlug: string, courseSlug: string, chapterSlug: string) =>
  prisma.chapter.findFirst({
    include: { course: true },
    where: {
      course: {
        isPublished: true,
        organization: { kind: "brand", slug: brandSlug },
        slug: courseSlug,
      },
      isPublished: true,
      slug: chapterSlug,
    },
  }),
);

export function getChapter(params: { brandSlug: string; chapterSlug: string; courseSlug: string }) {
  return cachedGetChapter(params.brandSlug, params.courseSlug, params.chapterSlug);
}

export type ChapterWithDetails = NonNullable<Awaited<ReturnType<typeof getChapter>>>;
