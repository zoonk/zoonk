import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export type LessonPosition = {
  lessonId: number;
  position: number;
};

export async function reorderLessons(params: {
  lessons: LessonPosition[];
  chapterId: number;
  headers?: Headers;
}): Promise<SafeReturn<{ updated: number }>> {
  const { data: chapter, error: findError } = await safeAsync(() =>
    prisma.chapter.findUnique({
      where: { id: params.chapterId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!chapter) {
    return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapter.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(
      params.lessons.map((lesson) =>
        prisma.chapterLesson.updateMany({
          data: { position: lesson.position },
          where: {
            chapterId: params.chapterId,
            lessonId: lesson.lessonId,
          },
        }),
      ),
    ),
  );

  if (error) {
    return { data: null, error };
  }

  const totalUpdated = data.reduce((acc, result) => acc + result.count, 0);

  return { data: { updated: totalUpdated }, error: null };
}
