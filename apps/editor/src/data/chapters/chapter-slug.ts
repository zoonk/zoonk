import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedChapterSlugExists = cache(async (courseId: number, slug: string): Promise<boolean> => {
  const { data } = await safeAsync(() =>
    prisma.chapter.findFirst({
      where: { courseId, slug },
    }),
  );

  return data !== null;
});

export function chapterSlugExists(params: { courseId: number; slug: string }): Promise<boolean> {
  return cachedChapterSlugExists(params.courseId, params.slug);
}
