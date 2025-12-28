import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const searchCourseChapters = cache(
  async (params: {
    courseSlug: string;
    headers?: Headers;
    language: string;
    orgSlug: string;
    title: string;
  }): Promise<{ data: Chapter[]; error: Error | null }> => {
    const { title, courseSlug, language, orgSlug } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
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

    const [hasPermission, chapters] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return { data: chapters, error: null };
  },
);
