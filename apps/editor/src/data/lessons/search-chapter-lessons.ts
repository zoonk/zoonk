import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const searchChapterLessons = cache(
  async (params: {
    chapterSlug: string;
    headers?: Headers;
    orgSlug: string;
    title: string;
  }): Promise<{ data: Lesson[]; error: Error | null }> => {
    const { title, chapterSlug, orgSlug } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
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
            normalizedTitle: {
              contains: normalizedSearch,
              mode: "insensitive",
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
