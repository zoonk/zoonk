import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type ChapterWithPosition = Chapter & {
  position: number;
};

export const listCourseChapters = cache(
  async (params: {
    courseSlug: string;
    headers?: Headers;
    language: string;
    orgSlug: string;
  }): Promise<{ data: ChapterWithPosition[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission: "update",
        }),
        prisma.courseChapter.findMany({
          include: { chapter: true },
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

    const [hasPermission, courseChapters] = data;

    if (!hasPermission) {
      return { data: [], error: new Error("Forbidden") };
    }

    const chapters = courseChapters.map((cc) => ({
      ...cc.chapter,
      position: cc.position,
    }));

    return { data: chapters, error: null };
  },
);
