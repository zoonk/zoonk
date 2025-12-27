import "server-only";

import { prisma } from "@zoonk/db";
import { cache } from "react";

export const listAlternativeTitles = cache(
  async (params: { courseId: number }): Promise<string[]> => {
    const results = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: params.courseId },
    });

    return results.map((r) => r.slug);
  },
);
