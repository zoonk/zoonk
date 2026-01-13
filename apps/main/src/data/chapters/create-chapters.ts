import "server-only";

import type { Chapter } from "@zoonk/db";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type ChapterInput = {
  title: string;
  description: string;
};

type CreateParams = {
  chapters: ChapterInput[];
  courseId: number;
  language: string;
  organizationId: number;
};

type CreatedChapter = Pick<
  Chapter,
  "id" | "slug" | "title" | "description" | "position"
>;

export async function createChapters(
  params: CreateParams,
): Promise<SafeReturn<CreatedChapter[]>> {
  const chaptersData = params.chapters.map((chapter, index) => ({
    courseId: params.courseId,
    description: chapter.description,
    generationStatus: "pending",
    isPublished: true,
    language: params.language,
    normalizedTitle: normalizeString(chapter.title),
    organizationId: params.organizationId,
    position: index,
    slug: toSlug(chapter.title),
    title: chapter.title,
  }));

  const { data, error } = await safeAsync(() =>
    prisma.chapter.createManyAndReturn({
      data: chaptersData,
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
