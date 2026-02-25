import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";

type LessonWithChapter = Lesson & {
  chapter: { slug: string; course: { slug: string } };
};

const cachedSearchOrgLessons = cache(
  async (
    orgSlug: string,
    title: string,
    limit: number,
    headers?: Headers,
  ): Promise<{ data: LessonWithChapter[]; error: Error | null }> => {
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.lesson.findMany({
          include: {
            chapter: {
              select: {
                course: { select: { slug: true } },
                slug: true,
              },
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

    const [hasPermission, lessons] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    return { data: lessons, error: null };
  },
);

export function searchOrgLessons(params: {
  headers?: Headers;
  orgSlug: string;
  title: string;
  limit?: number;
}): Promise<{ data: LessonWithChapter[]; error: Error | null }> {
  const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);
  return cachedSearchOrgLessons(params.orgSlug, params.title, limit, params.headers);
}
