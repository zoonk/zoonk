import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, getActiveChapterWhere, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedGetAuthorizedActiveChapter = cache(
  async (chapterId: number, headers?: Headers): Promise<SafeReturn<Chapter>> => {
    const { data: chapter, error: findError } = await safeAsync(() =>
      prisma.chapter.findFirst({
        where: getActiveChapterWhere({
          chapterWhere: { id: chapterId },
        }),
      }),
    );

    if (findError) {
      return { data: null, error: findError };
    }

    if (!chapter) {
      return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
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

/**
 * Lesson slug checks receive a chapter id from the browser, so this helper
 * resolves the canonical active chapter on the server and confirms the caller
 * can still update that organization before any follow-up query trusts the id.
 * React cache deduplicates repeated authorized chapter reads in the same request.
 */
export function getAuthorizedActiveChapter(params: {
  chapterId: number;
  headers?: Headers;
}): Promise<SafeReturn<Chapter>> {
  return cachedGetAuthorizedActiveChapter(params.chapterId, params.headers);
}
