import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

export type ActivityPosition = {
  activityId: bigint;
  position: number;
};

export async function reorderActivities(params: {
  activities: ActivityPosition[];
  lessonId: number;
  headers?: Headers;
}): Promise<SafeReturn<{ updated: number }>> {
  const { data: lesson, error: findError } = await safeAsync(() =>
    prisma.lesson.findUnique({
      where: { id: params.lessonId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!lesson) {
    return { data: null, error: new AppError(ErrorCode.lessonNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: lesson.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(
      params.activities.map((activity) =>
        prisma.activity.updateMany({
          data: { position: activity.position },
          where: {
            id: activity.activityId,
            lessonId: params.lessonId,
          },
        }),
      ),
    ),
  );

  if (error) {
    return { data: null, error };
  }

  const totalUpdated = data.reduce((acc, result) => acc + result.count, 0);

  return { data: { updated: totalUpdated }, error: null };
}
