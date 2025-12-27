import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseChapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function removeChapterFromCourse(params: {
  chapterId: number;
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<CourseChapter>> {
  const { data: courseChapter, error: findError } = await safeAsync(() =>
    prisma.courseChapter.findUnique({
      include: { course: true },
      where: {
        courseChapter: {
          chapterId: params.chapterId,
          courseId: params.courseId,
        },
      },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!courseChapter) {
    return { data: null, error: new AppError(ErrorCode.chapterNotInCourse) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: courseChapter.course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock course row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${params.courseId} FOR UPDATE`;

      // Re-fetch position after lock to get current value (may have changed)
      const current = await tx.courseChapter.findUnique({
        select: { position: true },
        where: { id: courseChapter.id },
      });

      if (!current) {
        throw new AppError(ErrorCode.chapterAlreadyRemoved);
      }

      await tx.courseChapter.delete({
        where: { id: courseChapter.id },
      });

      await tx.courseChapter.updateMany({
        data: { position: { decrement: 1 } },
        where: {
          courseId: params.courseId,
          position: { gt: current.position },
        },
      });

      const remainingLinks = await tx.courseChapter.count({
        where: { chapterId: params.chapterId },
      });

      if (remainingLinks === 0) {
        await tx.chapter.delete({
          where: { id: params.chapterId },
        });
      }
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: courseChapter, error: null };
}
