import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { ErrorCode } from "@/lib/app-error";

export async function createLesson(params: {
  chapterId: number;
  description: string;
  headers?: Headers;
  position: number;
  slug: string;
  title: string;
}): Promise<SafeReturn<Lesson>> {
  const { data: chapter, error: findError } = await safeAsync(() =>
    prisma.chapter.findUnique({
      where: { id: params.chapterId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!chapter) {
    return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapter.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const lessonSlug = toSlug(params.slug);
  const normalizedTitle = normalizeString(params.title);

  const { data: lesson, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      // Lock chapter row to prevent race conditions with concurrent position updates
      await tx.$queryRaw`SELECT id FROM chapters WHERE id = ${params.chapterId} FOR UPDATE`;

      await tx.lesson.updateMany({
        data: { position: { increment: 1 } },
        where: {
          chapterId: params.chapterId,
          position: { gte: params.position },
        },
      });

      return tx.lesson.create({
        data: {
          chapterId: params.chapterId,
          description: params.description,
          isPublished: !chapter.isPublished,
          kind: "custom",
          language: chapter.language,
          normalizedTitle,
          organizationId: chapter.organizationId,
          position: params.position,
          slug: lessonSlug,
          title: params.title,
        },
      });
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: lesson, error: null };
}
