import "server-only";

import type { Chapter } from "@zoonk/db";
import { prisma } from "@zoonk/db";
import { AI_ORG_ID } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type ChapterInput = {
  title: string;
  description: string;
};

type CreateParams = {
  courseId: number;
  language: string;
  generationRunId: string;
  chapters: ChapterInput[];
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
    generationRunId: params.generationRunId,
    generationStatus: "completed",
    isPublished: true,
    language: params.language,
    normalizedTitle: normalizeString(chapter.title),
    organizationId: AI_ORG_ID,
    position: index,
    slug: toSlug(chapter.title),
    title: chapter.title,
  }));

  const { data, error } = await safeAsync(async () => {
    await prisma.chapter.createMany({ data: chaptersData });

    return prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: { courseId: params.courseId },
    });
  });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
