import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseCategory, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function removeCategoryFromCourse(params: {
  category: string;
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<CourseCategory>> {
  const { data: courseCategory, error: findError } = await safeAsync(() =>
    prisma.courseCategory.findUnique({
      include: { course: true },
      where: {
        courseCategory: {
          category: params.category,
          courseId: params.courseId,
        },
      },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!courseCategory) {
    return { data: null, error: new AppError(ErrorCode.categoryNotInCourse) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: courseCategory.course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { error } = await safeAsync(() =>
    prisma.courseCategory.delete({
      where: { id: courseCategory.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: courseCategory, error: null };
}
