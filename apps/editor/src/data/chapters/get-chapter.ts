import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedGetChapter = cache(
  async (
    chapterSlug: string,
    courseSlug: string,
    orgSlug: string,
    headers?: Headers,
  ): Promise<SafeReturn<Chapter | null>> => {
    const { data: chapter, error: findError } = await safeAsync(() =>
      prisma.chapter.findFirst({
        where: {
          course: {
            organization: { slug: orgSlug },
            slug: courseSlug,
          },
          slug: chapterSlug,
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
      headers,
      orgId: chapter.organizationId,
      permission: "update",
    });

    if (!hasPermission) {
      return { data: null, error: new AppError(ErrorCode.forbidden) };
    }

    return { data: chapter, error: null };
  },
);

export function getChapter(params: {
  chapterSlug: string;
  courseSlug: string;
  headers?: Headers;
  orgSlug: string;
}): Promise<SafeReturn<Chapter | null>> {
  return cachedGetChapter(params.chapterSlug, params.courseSlug, params.orgSlug, params.headers);
}
