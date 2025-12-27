import "server-only";

import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export type AlternativeTitlesExport = {
  alternativeTitles: string[];
  exportedAt: string;
  version: number;
};

export async function exportAlternativeTitles(params: {
  courseId: number;
}): Promise<SafeReturn<AlternativeTitlesExport>> {
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

  const { data: titles, error: titlesError } = await safeAsync(() =>
    prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: params.courseId },
    }),
  );

  if (titlesError) {
    return { data: null, error: titlesError };
  }

  return {
    data: {
      alternativeTitles: titles.map((t) => t.slug),
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    error: null,
  };
}
