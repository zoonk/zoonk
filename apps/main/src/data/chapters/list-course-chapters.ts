import "server-only";
import { type GenerationStatus, prisma } from "@zoonk/db";
import { cache } from "react";

export type ChapterForList = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  generationStatus: GenerationStatus;
};

const cachedListCourseChapters = cache(
  async (brandSlug: string, courseSlug: string, language: string): Promise<ChapterForList[]> =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        generationStatus: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: {
        course: {
          isPublished: true,
          language,
          organization: {
            kind: "brand",
            slug: brandSlug,
          },
          slug: courseSlug,
        },
        isPublished: true,
      },
    }),
);

export function listCourseChapters(params: {
  brandSlug: string;
  courseSlug: string;
  language: string;
}): Promise<ChapterForList[]> {
  return cachedListCourseChapters(params.brandSlug, params.courseSlug, params.language);
}
