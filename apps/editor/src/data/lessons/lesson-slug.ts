import "server-only";

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const lessonSlugExists = cache(
  async (params: { chapterId: number; slug: string }): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      prisma.lesson.findFirst({
        select: { id: true },
        where: {
          chapterId: params.chapterId,
          slug: params.slug,
        },
      }),
    );

    return data !== null;
  },
);
