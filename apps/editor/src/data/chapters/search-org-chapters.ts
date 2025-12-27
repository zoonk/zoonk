import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export type ChapterWithCourses = Chapter & {
  courses: { slug: string; language: string }[];
};

export const searchOrgChapters = cache(
  async (params: {
    headers?: Headers;
    orgSlug: string;
    title: string;
  }): Promise<{ data: ChapterWithCourses[]; error: Error | null }> => {
    const { title, orgSlug } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission: "update",
        }),
        prisma.chapter.findMany({
          include: {
            courseChapters: {
              select: {
                course: { select: { language: true, slug: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
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

    const chaptersWithCourses = chapters.map(
      ({ courseChapters, ...chapter }) => ({
        ...chapter,
        courses: courseChapters.map((cc) => cc.course),
      }),
    );

    return { data: chaptersWithCourses, error: null };
  },
);
