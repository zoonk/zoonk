import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function deleteLesson(params: {
  lessonId: number;
  headers?: Headers;
}): Promise<SafeReturn<Lesson>> {
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
    permission: "delete",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { error } = await safeAsync(() =>
    prisma.lesson.delete({
      where: { id: lesson.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: lesson, error: null };
}
