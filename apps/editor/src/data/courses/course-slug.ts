import "server-only";

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedCourseSlugExists = cache(
  async (language: string, orgSlug: string, slug: string): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      prisma.course.findFirst({
        select: { id: true },
        where: {
          language,
          organization: { slug: orgSlug },
          slug,
        },
      }),
    );

    return data !== null;
  },
);

export function courseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return cachedCourseSlugExists(params.language, params.orgSlug, params.slug);
}
