import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";

const SEARCH_COURSES_LIMIT = 50;

export const searchCourses = cache(
  async (params: { query: string; language: string }): Promise<Course[]> => {
    const normalizedSearch = normalizeString(params.query);

    if (!normalizedSearch) {
      return [];
    }

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      take: SEARCH_COURSES_LIMIT,
      where: {
        isPublished: true,
        language: params.language,
        normalizedTitle: { contains: normalizedSearch, mode: "insensitive" },
        organization: { kind: "brand" },
      },
    });

    return courses;
  },
);
