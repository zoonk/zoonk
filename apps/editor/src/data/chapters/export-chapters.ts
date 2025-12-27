import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export type ExportedChapter = {
  description: string;
  position: number;
  slug: string;
  title: string;
};

export type ChaptersExport = {
  chapters: ExportedChapter[];
  exportedAt: string;
  version: number;
};

export async function exportChapters(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<ChaptersExport>> {
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

  const { data: courseChapters, error: chaptersError } = await safeAsync(() =>
    prisma.courseChapter.findMany({
      include: { chapter: true },
      orderBy: { position: "asc" },
      where: { courseId: params.courseId },
    }),
  );

  if (chaptersError) {
    return { data: null, error: chaptersError };
  }

  const chapters: ExportedChapter[] = courseChapters.map((cc) => ({
    description: cc.chapter.description,
    position: cc.position,
    slug: cc.chapter.slug,
    title: cc.chapter.title,
  }));

  return {
    data: {
      chapters,
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    error: null,
  };
}
