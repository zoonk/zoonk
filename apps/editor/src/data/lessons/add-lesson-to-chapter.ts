import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type ChapterLesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function addLessonToChapter(params: {
  lessonId: number;
  chapterId: number;
  headers?: Headers;
  position: number;
}): Promise<SafeReturn<ChapterLesson>> {
  const { data: result, error: findError } = await safeAsync(() =>
    Promise.all([
      prisma.chapter.findUnique({
        where: { id: params.chapterId },
      }),
      prisma.lesson.findUnique({
        where: { id: params.lessonId },
      }),
    ]),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  const [chapter, lesson] = result;

  if (!chapter) {
    return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
  }

  if (!lesson) {
    return { data: null, error: new AppError(ErrorCode.lessonNotFound) };
  }

  if (chapter.organizationId !== lesson.organizationId) {
    return {
      data: null,
      error: new AppError(ErrorCode.orgMismatch),
    };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapter.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: chapterLesson, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock chapter row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM chapters WHERE id = ${params.chapterId} FOR UPDATE`;

      await tx.chapterLesson.updateMany({
        data: { position: { increment: 1 } },
        where: {
          chapterId: params.chapterId,
          position: { gte: params.position },
        },
      });

      if (!chapter.isPublished) {
        await tx.lesson.update({
          data: { isPublished: true },
          where: { id: params.lessonId },
        });
      }

      return tx.chapterLesson.create({
        data: {
          chapterId: params.chapterId,
          lessonId: params.lessonId,
          position: params.position,
        },
      });
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: chapterLesson, error: null };
}
