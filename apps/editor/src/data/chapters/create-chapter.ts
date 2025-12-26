import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

export async function createChapter(params: {
  courseId: number;
  description: string;
  headers?: Headers;
  position: number;
  slug: string;
  title: string;
}): Promise<
  SafeReturn<{
    chapter: Chapter;
    courseChapterId: number;
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

  const chapterSlug = toSlug(params.slug);
  const normalizedTitle = normalizeString(params.title);

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock course row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${params.courseId} FOR UPDATE`;

      const chapter = await tx.chapter.create({
        data: {
          description: params.description,
          normalizedTitle,
          organizationId: course.organizationId,
          slug: chapterSlug,
          title: params.title,
        },
      });

      await tx.courseChapter.updateMany({
        data: { position: { increment: 1 } },
        where: {
          courseId: params.courseId,
          position: { gte: params.position },
        },
      });

      const courseChapter = await tx.courseChapter.create({
        data: {
          chapterId: chapter.id,
          courseId: params.courseId,
          position: params.position,
        },
      });

      return { chapter, courseChapterId: courseChapter.id };
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
