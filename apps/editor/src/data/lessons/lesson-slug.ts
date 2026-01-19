import "server-only";

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedLessonSlugExists = cache(
  async (chapterId: number, slug: string): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      prisma.lesson.findFirst({
        select: { id: true },
        where: { chapterId, slug },
      }),
    );

    return data !== null;
  },
);

export function lessonSlugExists(params: {
  chapterId: number;
  slug: string;
}): Promise<boolean> {
  return cachedLessonSlugExists(params.chapterId, params.slug);
}
