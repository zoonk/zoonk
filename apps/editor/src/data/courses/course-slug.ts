import "server-only";

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const courseSlugExists = cache(
  async (params: {
    language: string;
    orgSlug: string;
    slug: string;
  }): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      prisma.course.findFirst({
        select: { id: true },
        where: {
          language: params.language,
          organization: { slug: params.orgSlug },
          slug: params.slug,
        },
      }),
    );

    return data !== null;
  },
);
