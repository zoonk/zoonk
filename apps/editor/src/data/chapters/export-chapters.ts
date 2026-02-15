import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

type ExportedChapter = {
  description: string;
  position: number;
  slug: string;
  title: string;
};

export async function exportChapters(params: { courseId: number; headers?: Headers }): Promise<
  SafeReturn<{
    chapters: ExportedChapter[];
    exportedAt: string;
    version: number;
  }>
> {
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

  const { data: chapters, error: chaptersError } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: params.courseId },
    }),
  );

  if (chaptersError) {
    return { data: null, error: chaptersError };
  }

  const exportedChapters: ExportedChapter[] = chapters.map((chapter) => ({
    description: chapter.description,
    position: chapter.position,
    slug: chapter.slug,
    title: chapter.title,
  }));

  return {
    data: {
      chapters: exportedChapters,
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    error: null,
  };
}
