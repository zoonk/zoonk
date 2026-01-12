import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const getChapter = cache(
  async (params: {
    chapterSlug: string;
    courseSlug: string;
    headers?: Headers;
    language: string;
    orgSlug: string;
  }): Promise<SafeReturn<Chapter | null>> => {
    const { data: chapter, error: findError } = await safeAsync(() =>
      prisma.chapter.findFirst({
        where: {
          course: {
            language: params.language,
            organization: { slug: params.orgSlug },
            slug: params.courseSlug,
          },
          slug: params.chapterSlug,
        },
      }),
    );

    if (findError) {
      return { data: null, error: findError };
    }

    if (!chapter) {
      return { data: null, error: null };
    }

    const hasPermission = await hasCoursePermission({
      headers: params.headers,
      orgId: chapter.organizationId,
      permission: "update",
    });

    if (!hasPermission) {
      return { data: null, error: new AppError(ErrorCode.forbidden) };
    }

    return { data: chapter, error: null };
  },
);
