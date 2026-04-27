import "server-only";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { type Chapter, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

export async function createChapter(params: {
  courseId: string;
  description: string;
  headers?: Headers;
  position: number;
  slug: string;
  title: string;
}): Promise<SafeReturn<Chapter>> {
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const chapterSlug = toSlug(params.slug);
  const normalizedTitle = normalizeString(params.title);

  const { data: chapter, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock course row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${course.id} FOR UPDATE`;

      await tx.chapter.updateMany({
        data: { position: { increment: 1 } },
        where: {
          archivedAt: null,
          courseId: course.id,
          position: { gte: params.position },
        },
      });

      return tx.chapter.create({
        data: {
          courseId: course.id,
          description: params.description,
          isPublished: !course.isPublished,
          language: course.language,
          normalizedTitle,
          organizationId: course.organizationId,
          position: params.position,
          slug: chapterSlug,
          title: params.title,
        },
      });
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: chapter, error: null };
}
