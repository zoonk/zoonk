import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";
import type { ChapterWithPosition } from "./list-course-chapters";

export const searchCourseChapters = cache(
  async (params: {
    courseSlug: string;
    headers?: Headers;
    language: string;
    orgSlug: string;
    title: string;
  }): Promise<{ data: ChapterWithPosition[]; error: Error | null }> => {
    const { title, courseSlug, language, orgSlug } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission: "update",
        }),
        prisma.courseChapter.findMany({
          include: { chapter: true },
          orderBy: { position: "asc" },
          where: {
            chapter: {
              normalizedTitle: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
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

    const [hasPermission, courseChapters] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    const chapters = courseChapters.map((cc) => ({
      ...cc.chapter,
      position: cc.position,
    }));

    return { data: chapters, error: null };
  },
);
