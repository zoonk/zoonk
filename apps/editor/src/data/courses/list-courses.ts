import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const LIST_COURSES_LIMIT = 20;

export const listCourses = cache(
  async (params: {
    orgSlug: string;
    headers?: Headers;
    language?: string;
    limit?: number;
  }): Promise<{ data: Course[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission: "update",
        }),
        prisma.course.findMany({
          orderBy: { createdAt: "desc" },
          take: clampQueryItems(params.limit ?? LIST_COURSES_LIMIT),
          where: {
            organization: { slug: params.orgSlug },
            ...(params.language && { language: params.language }),
          },
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, courses] = data;

    if (!hasPermission) {
      return { data: [], error: new Error("Forbidden") };
    }

    return { data: courses, error: null };
  },
);
