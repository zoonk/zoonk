import "server-only";

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const chapterSlugExists = cache(
  async (params: { courseId: number; slug: string }): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      prisma.chapter.findFirst({
        select: { id: true },
        where: {
          courseId: params.courseId,
          slug: params.slug,
        },
      }),
    );

    return data !== null;
  },
);
