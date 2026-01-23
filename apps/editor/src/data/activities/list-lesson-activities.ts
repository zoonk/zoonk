import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Activity, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListLessonActivities = cache(
  async (
    lessonId: number,
    orgId: number,
    headers?: Headers,
  ): Promise<{ data: Activity[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgId,
          permission: "update",
        }),
        prisma.activity.findMany({
          orderBy: { position: "asc" },
          where: { lessonId, organizationId: orgId },
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
  headers?: Headers;
  lessonId: number;
  orgId: number;
}): Promise<{ data: Activity[]; error: Error | null }> {
  return cachedListLessonActivities(params.lessonId, params.orgId, params.headers);
}
