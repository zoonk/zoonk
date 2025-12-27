import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type ChapterLesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function removeLessonFromChapter(params: {
  lessonId: number;
  chapterId: number;
  headers?: Headers;
}): Promise<SafeReturn<ChapterLesson>> {
  const { data: chapterLesson, error: findError } = await safeAsync(() =>
    prisma.chapterLesson.findUnique({
      include: { chapter: true },
      where: {
        chapterLesson: {
          chapterId: params.chapterId,
          lessonId: params.lessonId,
        },
      },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!chapterLesson) {
    return { data: null, error: new AppError(ErrorCode.lessonNotInChapter) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapterLesson.chapter.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock chapter row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM chapters WHERE id = ${params.chapterId} FOR UPDATE`;

      // Re-fetch position after lock to get current value (may have changed)
      const current = await tx.chapterLesson.findUnique({
        select: { position: true },
        where: { id: chapterLesson.id },
      });

      if (!current) {
        throw new AppError(ErrorCode.lessonAlreadyRemoved);
      }

      await tx.chapterLesson.delete({
        where: { id: chapterLesson.id },
      });

      await tx.chapterLesson.updateMany({
        data: { position: { decrement: 1 } },
        where: {
          chapterId: params.chapterId,
          position: { gt: current.position },
        },
      });

      const remainingLinks = await tx.chapterLesson.count({
        where: { lessonId: params.lessonId },
      });

      if (remainingLinks === 0) {
        await tx.lesson.delete({
          where: { id: params.lessonId },
        });
      }
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: chapterLesson, error: null };
}
