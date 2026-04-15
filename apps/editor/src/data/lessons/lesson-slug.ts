import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { getAuthorizedActiveChapter } from "../chapters/get-authorized-chapter";

const cachedLessonSlugExists = cache(async (chapterId: number, slug: string): Promise<boolean> => {
  const { data } = await safeAsync(() =>
    prisma.lesson.findFirst({
      where: { chapterId, slug },
    }),
  );

  return data !== null;
});

/**
 * Lesson slug checks are scoped by chapter id, so this helper first resolves
 * the canonical active chapter the caller can still update before it performs
 * the existence query inside that chapter.
 */
export async function lessonSlugExists(params: {
  chapterId: number;
  headers?: Headers;
  slug: string;
}): Promise<boolean> {
  if (!params.slug.trim()) {
    return false;
  }

  const { data: chapter, error } = await getAuthorizedActiveChapter({
    chapterId: params.chapterId,
    headers: params.headers,
  });

  if (error) {
    return false;
  }

  return cachedLessonSlugExists(chapter.id, params.slug);
}
