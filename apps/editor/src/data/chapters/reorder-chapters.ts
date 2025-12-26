import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export type ChapterPosition = {
  chapterId: number;
  position: number;
};

export async function reorderChapters(params: {
  chapters: ChapterPosition[];
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<{ updated: number }>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      where: { id: params.courseId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!course) {
    return { data: null, error: new Error("Course not found") };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(
      params.chapters.map((chapter) =>
        prisma.courseChapter.updateMany({
          data: { position: chapter.position },
          where: {
            chapterId: chapter.chapterId,
            courseId: params.courseId,
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
