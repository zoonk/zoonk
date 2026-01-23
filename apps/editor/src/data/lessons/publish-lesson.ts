import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function toggleLessonPublished(params: {
  lessonId: number;
  headers?: Headers;
  isPublished: boolean;
}): Promise<SafeReturn<Lesson>> {
  const { data: lesson, error: findError } = await safeAsync(() =>
    prisma.lesson.findUnique({
      select: { id: true, organizationId: true },
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
    prisma.lesson.update({
      data: { isPublished: params.isPublished },
      where: { id: lesson.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
