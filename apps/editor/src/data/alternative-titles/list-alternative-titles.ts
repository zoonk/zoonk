import "server-only";

import { prisma } from "@zoonk/db";
import { cache } from "react";

type ListAlternativeTitlesParams =
  | { courseId: number }
  | { courseSlug: string };

export const listAlternativeTitles = cache(
  async (params: ListAlternativeTitlesParams): Promise<string[]> => {
    const where =
      "courseId" in params
        ? { courseId: params.courseId }
        : { course: { slug: params.courseSlug } };

    const results = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where,
    });

    return results.map((r) => r.slug);
  },
);
