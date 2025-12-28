import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const getLesson = cache(
  async (params: {
    headers?: Headers;
    language: string;
    lessonSlug: string;
    orgSlug: string;
  }): Promise<SafeReturn<Lesson | null>> => {
    const { data: lesson, error: findError } = await safeAsync(() =>
      prisma.lesson.findFirst({
        where: {
          language: params.language,
          organization: { slug: params.orgSlug },
          slug: params.lessonSlug,
        },
      }),
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
