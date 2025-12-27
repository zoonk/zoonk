import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseChapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function addChapterToCourse(params: {
  chapterId: number;
  courseId: number;
  headers?: Headers;
  position: number;
}): Promise<SafeReturn<CourseChapter>> {
  const { data: result, error: findError } = await safeAsync(() =>
    Promise.all([
      prisma.course.findUnique({
        where: { id: params.courseId },
      }),
      prisma.chapter.findUnique({
        where: { id: params.chapterId },
      }),
    ]),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  const [course, chapter] = result;

  if (!course) {
    return { data: null, error: new AppError(ErrorCode.courseNotFound) };
  }

  if (!chapter) {
    return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
  }

  if (course.organizationId !== chapter.organizationId) {
    return {
      data: null,
      error: new AppError(ErrorCode.orgMismatch),
    };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: courseChapter, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock course row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${params.courseId} FOR UPDATE`;

      await tx.courseChapter.updateMany({
        data: { position: { increment: 1 } },
        where: {
          courseId: params.courseId,
          position: { gte: params.position },
        },
      });

      return tx.courseChapter.create({
        data: {
          chapterId: params.chapterId,
          courseId: params.courseId,
          position: params.position,
        },
      });
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: courseChapter, error: null };
}
