import "server-only";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

export async function createLessons(params: {
  chapterId: number;
  language: string;
  lessons: {
    title: string;
    description: string;
  }[];
  organizationId: number;
}): Promise<SafeReturn<void>> {
  const lessonsData = params.lessons.map((lesson, index) => ({
    chapterId: params.chapterId,
    description: lesson.description,
    generationStatus: "pending" as const,
    isPublished: true,
    language: params.language,
    normalizedTitle: normalizeString(lesson.title),
    organizationId: params.organizationId,
    position: index,
    slug: toSlug(lesson.title),
    title: lesson.title,
  }));

  const { error } = await safeAsync(() => prisma.lesson.createMany({ data: lessonsData }));

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
