import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";
import { cache } from "react";

type ExistingCourse = {
  id: number;
  slug: string;
  generationStatus: string;
};

const cachedFindExistingCourse = cache(
  async (
    slug: string,
    language: string,
  ): Promise<SafeReturn<ExistingCourse | null>> => {
    const normalizedSlug = toSlug(slug);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        prisma.course.findFirst({
          select: { generationStatus: true, id: true, slug: true },
          where: {
            language,
            organization: { slug: AI_ORG_SLUG },
            slug: normalizedSlug,
          },
        }),
        prisma.courseAlternativeTitle.findUnique({
          select: {
            course: {
              select: { generationStatus: true, id: true, slug: true },
            },
          },
          where: {
            languageSlug: { language, slug: normalizedSlug },
          },
        }),
      ]),
    );

    if (error) {
      return { data: null, error };
    }

    const [courseMatch, alternativeTitleMatch] = data;

    if (courseMatch) {
      return { data: courseMatch, error: null };
    }

    if (alternativeTitleMatch) {
      return { data: alternativeTitleMatch.course, error: null };
    }

    return { data: null, error: null };
  },
);

export function findExistingCourse(params: {
  slug: string;
  language: string;
}): Promise<SafeReturn<ExistingCourse | null>> {
  return cachedFindExistingCourse(params.slug, params.language);
}
