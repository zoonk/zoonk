import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Activity, type ActivityKind, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function createActivity(params: {
  description?: string;
  headers?: Headers;
  kind: ActivityKind;
  lessonId: number;
  position: number;
  title?: string;
}): Promise<SafeReturn<Activity>> {
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

  const { data: activity, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lessons WHERE id = ${params.lessonId} FOR UPDATE`;

      await tx.activity.updateMany({
        data: { position: { increment: 1 } },
        where: {
          lessonId: params.lessonId,
          position: { gte: params.position },
        },
      });

      return tx.activity.create({
        data: {
          description: params.description,
          isPublished: !lesson.isPublished,
          kind: params.kind,
          language: lesson.language,
          lessonId: params.lessonId,
          organizationId: lesson.organizationId,
          position: params.position,
          title: params.title,
        },
      });
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: activity, error: null };
}
