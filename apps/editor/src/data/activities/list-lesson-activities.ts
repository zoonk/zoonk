import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Activity, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

const cachedListLessonActivities = cache(
  async (
    lessonSlug: string,
    orgSlug: string,
    headers?: Headers,
  ): Promise<{ data: Activity[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.activity.findMany({
          orderBy: { position: "asc" },
          where: {
            lesson: {
              organization: { slug: orgSlug },
              slug: lessonSlug,
            },
          },
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, activities] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return { data: activities, error: null };
  },
);

export function listLessonActivities(params: {
  lessonSlug: string;
  headers?: Headers;
  orgSlug: string;
}): Promise<{ data: Activity[]; error: Error | null }> {
  return cachedListLessonActivities(
    params.lessonSlug,
    params.orgSlug,
    params.headers,
  );
}
