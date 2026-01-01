import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function deleteCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      where: { id: params.courseId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!course) {
    return { data: null, error: new AppError(ErrorCode.courseNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: course.isPublished ? "delete" : "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  // Chapters and lessons cascade delete automatically via FK constraints
  const { error } = await safeAsync(() =>
    prisma.course.delete({ where: { id: course.id } }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: course, error: null };
}
