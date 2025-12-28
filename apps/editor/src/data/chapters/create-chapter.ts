import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { ErrorCode } from "@/lib/app-error";

export async function createChapter(params: {
  courseId: number;
  description: string;
  headers?: Headers;
  position: number;
  slug: string;
  title: string;
}): Promise<SafeReturn<Chapter>> {
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

  const chapterSlug = toSlug(params.slug);
  const normalizedTitle = normalizeString(params.title);

  const { data: chapter, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock course row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${params.courseId} FOR UPDATE`;

      await tx.chapter.updateMany({
        data: { position: { increment: 1 } },
        where: {
          courseId: params.courseId,
          position: { gte: params.position },
        },
      });

      return tx.chapter.create({
        data: {
          courseId: params.courseId,
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
