import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const listCourseChapters = cache(
  async (params: {
    courseSlug: string;
    headers?: Headers;
    language: string;
    orgSlug: string;
  }): Promise<{ data: Chapter[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission: "update",
        }),
        prisma.chapter.findMany({
          orderBy: { position: "asc" },
          where: {
            course: {
              language: params.language,
              organization: { slug: params.orgSlug },
              slug: params.courseSlug,
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
