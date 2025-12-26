import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const getCourse = cache(
  async (params: {
    courseSlug: string;
    language: string;
    orgSlug: string;
    headers?: Headers;
  }): Promise<SafeReturn<Course | null>> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission: "update",
        }),
        prisma.course.findFirst({
          where: {
            language: params.language,
            organization: { slug: params.orgSlug },
            slug: params.courseSlug,
          },
        }),
      ]),
    );

    if (error) {
      return { data: null, error };
    }

    const [hasPermission, course] = data;

    if (!course) {
      return { data: null, error: null };
    }

    if (!hasPermission) {
      return { data: null, error: new Error("Forbidden") };
    }

    return { data: course, error: null };
  },
);
