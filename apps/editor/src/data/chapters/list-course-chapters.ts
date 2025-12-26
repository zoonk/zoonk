import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const LIST_CHAPTERS_LIMIT = 50;

interface ChapterWithPosition extends Chapter {
  position: number;
}

export const listCourseChapters = cache(
  async (params: {
    courseSlug: string;
    headers?: Headers;
    language: string;
    limit?: number;
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
          take: clampQueryItems(params.limit ?? LIST_CHAPTERS_LIMIT),
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
