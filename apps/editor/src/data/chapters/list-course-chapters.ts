import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListCourseChapters = cache(
  async (
    courseSlug: string,
    language: string,
    orgSlug: string,
    headers?: Headers,
  ): Promise<{ data: Chapter[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.chapter.findMany({
          orderBy: { position: "asc" },
          where: {
            course: {
              language,
              organization: { slug: orgSlug },
              slug: courseSlug,
            },
          },
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
  courseSlug: string;
  headers?: Headers;
  language: string;
  orgSlug: string;
}): Promise<{ data: Chapter[]; error: Error | null }> {
  return cachedListCourseChapters(
    params.courseSlug,
    params.language,
    params.orgSlug,
    params.headers,
  );
}
