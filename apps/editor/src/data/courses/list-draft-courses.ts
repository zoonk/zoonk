import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

const cachedListDraftCourses = cache(
  async (
    orgSlug: string,
    language?: string,
    headers?: Headers,
  ): Promise<{ data: Course[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.course.findMany({
          orderBy: { createdAt: "desc" },
          where: {
            isPublished: false,
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
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return { data: courses, error: null };
  },
);

export function listDraftCourses(params: {
  orgSlug: string;
  headers?: Headers;
  language?: string;
}): Promise<{ data: Course[]; error: Error | null }> {
  return cachedListDraftCourses(
    params.orgSlug,
    params.language,
    params.headers,
  );
}
