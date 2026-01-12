import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { mergeSearchResults } from "@zoonk/utils/search";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export const searchCourses = cache(
  async (params: {
    title: string;
    orgSlug: string;
    headers?: Headers;
    language?: string;
    limit?: number;
  }): Promise<{ data: Course[]; error: Error | null }> => {
    const { title, orgSlug, language } = params;
    const normalizedSearch = normalizeString(title);
    const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);

    const baseWhere = {
      organization: { slug: orgSlug },
      ...(language && { language }),
    };

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission: "update",
        }),
        prisma.course.findFirst({
          where: {
            ...baseWhere,
            normalizedTitle: normalizedSearch,
          },
        }),
        prisma.course.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          where: {
            ...baseWhere,
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

    const [hasPermission, exactMatch, containsMatches] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return {
      data: mergeSearchResults(exactMatch, containsMatches),
      error: null,
    };
  },
);
