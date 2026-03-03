import "server-only";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { removeLocaleSuffix } from "@zoonk/utils/string";
import { cache } from "react";

const cachedCourseSlugExists = cache(
  async (orgSlug: string, slug: string, language: string): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      Promise.all([
        prisma.course.findFirst({
          where: { organization: { slug: orgSlug }, slug },
        }),
        prisma.courseAlternativeTitle.findUnique({
          where: { languageSlug: { language, slug: removeLocaleSuffix(slug, language) } },
        }),
      ]),
    );

    if (!data) {
      return false;
    }

    const [course, altTitle] = data;
    return Boolean(course) || (orgSlug === AI_ORG_SLUG && Boolean(altTitle));
  },
);

export function courseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return cachedCourseSlugExists(params.orgSlug, params.slug, params.language);
}
