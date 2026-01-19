import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

const cachedListChapterLessons = cache(
  async (
    chapterSlug: string,
    orgSlug: string,
    headers?: Headers,
  ): Promise<{ data: Lesson[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.lesson.findMany({
          orderBy: { position: "asc" },
          where: {
            chapter: {
              organization: { slug: orgSlug },
              slug: chapterSlug,
            },
          },
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
  chapterSlug: string;
  headers?: Headers;
  orgSlug: string;
}): Promise<{ data: Lesson[]; error: Error | null }> {
  return cachedListChapterLessons(
    params.chapterSlug,
    params.orgSlug,
    params.headers,
  );
}
