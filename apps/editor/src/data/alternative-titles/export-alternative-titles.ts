import "server-only";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { getAuthorizedCourse } from "../courses/get-authorized-course";

/**
 * Export needs the same authorization boundary as mutations because the action
 * can be replayed directly and exposes internal duplicate-detection data.
 */
export async function exportAlternativeTitles(params: {
  courseId: string;
  headers?: Headers;
}): Promise<
  SafeReturn<{
    alternativeTitles: string[];
    exportedAt: string;
    version: number;
  }>
> {
  const { error: courseError } = await getAuthorizedCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
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
