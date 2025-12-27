import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseCategory, prisma } from "@zoonk/db";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function addCategoryToCourse(params: {
  category: string;
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<CourseCategory>> {
  if (!COURSE_CATEGORIES.includes(params.category as never)) {
    return { data: null, error: new AppError(ErrorCode.invalidCategory) };
  }

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
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: courseCategory, error } = await safeAsync(() =>
    prisma.courseCategory.create({
      data: {
        category: params.category,
        courseId: params.courseId,
      },
    }),
  );

  if (error) {
    if (error.message.includes("Unique constraint")) {
      return {
        data: null,
        error: new AppError(ErrorCode.categoryAlreadyAdded),
      };
    }
    return { data: null, error };
  }

  return { data: courseCategory, error: null };
}
