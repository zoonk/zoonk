import "server-only";

import { type Course, type Organization, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";

export type CourseWithOrganization = Course & {
  organization: Organization;
};

export const searchCourses = cache(
  async (params: {
    query: string;
    language: string;
    limit?: number;
  }): Promise<CourseWithOrganization[]> => {
    const normalizedSearch = normalizeString(params.query);

    if (!normalizedSearch) {
      return [];
    }

    const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);

    const courses = await prisma.course.findMany({
      include: { organization: true },
      orderBy: { createdAt: "desc" },
      take: limit,
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
