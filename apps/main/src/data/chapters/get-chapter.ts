import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type ChapterWithDetails = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  course: {
    slug: string;
    title: string;
  };
};

const cachedGetChapter = cache(
  async (
    brandSlug: string,
    courseSlug: string,
    chapterSlug: string,
  ): Promise<ChapterWithDetails | null> =>
    prisma.chapter.findFirst({
      select: {
        course: { select: { slug: true, title: true } },
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
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

export function getChapter(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
}): Promise<ChapterWithDetails | null> {
  return cachedGetChapter(params.brandSlug, params.courseSlug, params.chapterSlug);
}
