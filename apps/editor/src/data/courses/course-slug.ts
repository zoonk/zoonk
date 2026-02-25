import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedCourseSlugExists = cache(async (orgSlug: string, slug: string): Promise<boolean> => {
  const { data } = await safeAsync(() =>
    prisma.course.findFirst({
      where: {
        organization: { slug: orgSlug },
        slug,
      },
    }),
  );

  return data !== null;
});

export function courseSlugExists(params: { orgSlug: string; slug: string }): Promise<boolean> {
  return cachedCourseSlugExists(params.orgSlug, params.slug);
}
