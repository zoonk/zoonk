import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const listChapterLessons = cache(
  async (params: {
    chapterSlug: string;
    headers?: Headers;
    orgSlug: string;
  }): Promise<{ data: Lesson[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission: "update",
        }),
        prisma.lesson.findMany({
          orderBy: { position: "asc" },
          where: {
            chapter: {
              organization: { slug: params.orgSlug },
              slug: params.chapterSlug,
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
