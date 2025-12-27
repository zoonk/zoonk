import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

async function findLesson(params: {
  lessonId?: number;
  lessonSlug?: string;
  orgSlug?: string;
}): Promise<Lesson | null> {
  if (params.lessonId) {
    return prisma.lesson.findUnique({
      where: { id: params.lessonId },
    });
  }

  if (params.lessonSlug && params.orgSlug) {
    return prisma.lesson.findFirst({
      where: {
        organization: { slug: params.orgSlug },
        slug: params.lessonSlug,
      },
    });
  }

  return null;
}

export const getLesson = cache(
  async (params: {
    lessonId?: number;
    lessonSlug?: string;
    headers?: Headers;
    orgSlug?: string;
  }): Promise<SafeReturn<Lesson | null>> => {
    const { data: lesson, error: findError } = await safeAsync(() =>
      findLesson(params),
    );

    if (findError) {
      return { data: null, error: findError };
    }

    if (!lesson) {
      return { data: null, error: null };
    }

    const hasPermission = await hasCoursePermission({
      headers: params.headers,
      orgId: lesson.organizationId,
      permission: "update",
    });

    if (!hasPermission) {
      return { data: null, error: new AppError(ErrorCode.forbidden) };
    }

    return { data: lesson, error: null };
  },
);
