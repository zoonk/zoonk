import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function deleteCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      include: { courseChapters: { select: { chapterId: true } } },
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
    permission: "delete",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const chapterIds = course.courseChapters.map((cc) => cc.chapterId);

  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await tx.course.delete({ where: { id: course.id } });

      if (chapterIds.length > 0) {
        const orphanedChapters = await tx.chapter.findMany({
          select: { id: true },
          where: {
            courseChapters: { none: {} },
            id: { in: chapterIds },
          },
        });

        if (orphanedChapters.length > 0) {
          await tx.chapter.deleteMany({
            where: { id: { in: orphanedChapters.map((c) => c.id) } },
          });
        }
      }
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: course, error: null };
}
