import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

type ExportedLesson = {
  description: string;
  position: number;
  slug: string;
  title: string;
};

export async function exportLessons(params: { chapterId: number; headers?: Headers }): Promise<
  SafeReturn<{
    lessons: ExportedLesson[];
    exportedAt: string;
    version: number;
  }>
> {
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

  const { data: lessons, error: lessonsError } = await safeAsync(() =>
    prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: params.chapterId },
    }),
  );

  if (lessonsError) {
    return { data: null, error: lessonsError };
  }

  const exportedLessons: ExportedLesson[] = lessons.map((lesson) => ({
    description: lesson.description,
    position: lesson.position,
    slug: lesson.slug,
    title: lesson.title,
  }));

  return {
    data: {
      exportedAt: new Date().toISOString(),
      lessons: exportedLessons,
      version: 1,
    },
    error: null,
  };
}
