import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function exportAlternativeTitles(params: { courseId: number }): Promise<
  SafeReturn<{
    alternativeTitles: string[];
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

  const { data: titles, error: titlesError } = await safeAsync(() =>
    prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
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
