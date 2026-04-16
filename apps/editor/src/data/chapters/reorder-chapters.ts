import "server-only";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function reorderChapters(params: {
  chapters: {
    chapterId: string;
    position: number;
  }[];
  courseId: string;
  headers?: Headers;
}): Promise<SafeReturn<{ updated: number }>> {
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(
      params.chapters.map((chapter) =>
        prisma.chapter.updateMany({
          data: { position: chapter.position },
          where: {
            archivedAt: null,
            courseId: course.id,
            id: chapter.chapterId,
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
