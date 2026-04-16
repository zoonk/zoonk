import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, getActiveLessonWhere, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListChapterLessons = cache(
  async (
    chapterId: string,
    orgId: string | null,
    headers?: Headers,
  ): Promise<{ data: Lesson[]; error: Error | null }> => {
    if (!orgId) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgId,
          permission: "update",
        }),
        prisma.lesson.findMany({
          orderBy: { position: "asc" },
          where: getActiveLessonWhere({
            lessonWhere: { chapterId, organizationId: orgId },
          }),
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, lessons] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return { data: lessons, error: null };
  },
);

export function listChapterLessons(params: {
  chapterId: string;
  headers?: Headers;
  orgId: string | null;
}): Promise<{ data: Lesson[]; error: Error | null }> {
  return cachedListChapterLessons(params.chapterId, params.orgId, params.headers);
}
