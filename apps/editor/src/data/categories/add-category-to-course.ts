import "server-only";
import { getAuthorizedCourse } from "@/data/courses/get-authorized-course";
import { ErrorCode } from "@/lib/app-error";
import { type CourseCategory, prisma } from "@zoonk/db";
import { isUniqueConstraintError } from "@zoonk/db/utils";
import { isValidCategory } from "@zoonk/utils/categories";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function addCategoryToCourse(params: {
  category: string;
  courseId: string;
  headers?: Headers;
}): Promise<SafeReturn<CourseCategory>> {
  if (!isValidCategory(params.category)) {
    return { data: null, error: new AppError(ErrorCode.invalidCategory) };
  }

  const { data: course, error: courseError } = await getAuthorizedCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const { data: courseCategory, error } = await safeAsync(() =>
    prisma.courseCategory.create({
      data: {
        category: params.category,
        courseId: course.id,
      },
    }),
  );

  if (error) {
    if (isUniqueConstraintError(error)) {
      return {
        data: null,
        error: new AppError(ErrorCode.categoryAlreadyAdded),
      };
    }
    return { data: null, error };
  }

  return { data: courseCategory, error: null };
}
