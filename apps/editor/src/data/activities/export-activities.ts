import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type ActivityKind, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

type ExportedActivity = {
  description: string | null;
  kind: ActivityKind;
  position: number;
  title: string | null;
};

export async function exportActivities(params: { lessonId: number; headers?: Headers }): Promise<
  SafeReturn<{
    activities: ExportedActivity[];
    exportedAt: string;
    version: number;
  }>
> {
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

  const { data: activities, error: activitiesError } = await safeAsync(() =>
    prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: params.lessonId },
    }),
  );

  if (activitiesError) {
    return { data: null, error: activitiesError };
  }

  const exportedActivities: ExportedActivity[] = activities.map((activity) => ({
    description: activity.description,
    kind: activity.kind,
    position: activity.position,
    title: activity.title,
  }));

  return {
    data: {
      activities: exportedActivities,
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    error: null,
  };
}
