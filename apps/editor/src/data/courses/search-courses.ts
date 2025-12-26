import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";

export const searchCourses = cache(
  async (params: {
    title: string;
    orgSlug: string;
    headers?: Headers;
    language?: string;
  }): Promise<{ data: Course[]; error: Error | null }> => {
    const { title, orgSlug, language } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission: "update",
        }),
        prisma.course.findMany({
          orderBy: { createdAt: "desc" },
          where: {
            normalizedTitle: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
            organization: { slug: orgSlug },
            ...(language && { language }),
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
