import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListCourseChapters = cache(
  async (
    courseId: number,
    orgId: number | null,
    headers?: Headers,
  ): Promise<{ data: Chapter[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgId,
          permission: "update",
        }),
        prisma.chapter.findMany({
          orderBy: { position: "asc" },
          where: { courseId },
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, chapters] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return { data: chapters, error: null };
  },
);

export function listCourseChapters(params: {
  courseId: number;
  headers?: Headers;
  orgId: number | null;
}): Promise<{ data: Chapter[]; error: Error | null }> {
  return cachedListCourseChapters(params.courseId, params.orgId, params.headers);
}
