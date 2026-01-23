import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

export async function updateLesson(params: {
  lessonId: number;
  description?: string;
  headers?: Headers;
  slug?: string;
  title?: string;
}): Promise<SafeReturn<Lesson>> {
  const { data: lesson, error: findError } = await safeAsync(() =>
    prisma.lesson.findUnique({
      where: { id: params.lessonId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!lesson) {
    return { data: null, error: new AppError(ErrorCode.lessonNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: lesson.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data, error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        ...(params.description !== undefined && {
          description: params.description,
        }),
        ...(params.slug !== undefined && { slug: toSlug(params.slug) }),
        ...(params.title !== undefined && {
          normalizedTitle: normalizeString(params.title),
          title: params.title,
        }),
      },
      where: { id: lesson.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
