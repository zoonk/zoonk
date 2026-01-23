import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListChapterLessons = cache(
  async (
    chapterId: number,
    orgId: number,
    headers?: Headers,
  ): Promise<{ data: Lesson[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgId,
          permission: "update",
        }),
        prisma.lesson.findMany({
          orderBy: { position: "asc" },
          where: { chapterId, organizationId: orgId },
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
  chapterId: number;
  headers?: Headers;
  orgId: number;
}): Promise<{ data: Lesson[]; error: Error | null }> {
  return cachedListChapterLessons(params.chapterId, params.orgId, params.headers);
}
