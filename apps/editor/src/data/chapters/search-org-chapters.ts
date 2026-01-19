import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export type ChapterWithCourse = Chapter & {
  course: { slug: string; language: string };
};

const cachedSearchOrgChapters = cache(
  async (
    orgSlug: string,
    title: string,
    limit: number,
    headers?: Headers,
  ): Promise<{ data: ChapterWithCourse[]; error: Error | null }> => {
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.chapter.findMany({
          include: {
            course: {
              select: { language: true, slug: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          where: {
            normalizedTitle: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
            organization: { slug: orgSlug },
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

export function searchOrgChapters(params: {
  headers?: Headers;
  orgSlug: string;
  title: string;
  limit?: number;
}): Promise<{ data: ChapterWithCourse[]; error: Error | null }> {
  const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);
  return cachedSearchOrgChapters(
    params.orgSlug,
    params.title,
    limit,
    params.headers,
  );
}
