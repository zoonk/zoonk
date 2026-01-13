import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_ID } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type LessonInput = {
  title: string;
  description: string;
};

type CreateParams = {
  chapterId: number;
  language: string;
  generationRunId: string;
  lessons: LessonInput[];
};

export async function createLessons(
  params: CreateParams,
): Promise<SafeReturn<void>> {
  const lessonsData = params.lessons.map((lesson, index) => ({
    chapterId: params.chapterId,
    description: lesson.description,
    generationRunId: params.generationRunId,
    generationStatus: "completed",
    isPublished: true,
    language: params.language,
    normalizedTitle: normalizeString(lesson.title),
    organizationId: AI_ORG_ID,
    position: index,
    slug: toSlug(lesson.title),
    title: lesson.title,
  }));

  const { error } = await safeAsync(() =>
    prisma.lesson.createMany({ data: lessonsData }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
