import "server-only";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { cache } from "react";

const courseInclude = {
  _count: {
    select: {
      alternativeTitles: true,
      categories: true,
      chapters: true,
    },
  },
} as const;

type ExistingCourse = NonNullable<
  Awaited<ReturnType<typeof prisma.course.findFirst<{ include: typeof courseInclude }>>>
>;

const cachedFindExistingCourse = cache(
  async (slug: string, language: string): Promise<SafeReturn<ExistingCourse | null>> => {
    const normalizedSlug = toSlug(slug);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        prisma.course.findFirst({
          include: courseInclude,
          where: {
            organization: { slug: AI_ORG_SLUG },
            slug: ensureLocaleSuffix(normalizedSlug, language),
          },
        }),
        prisma.courseAlternativeTitle.findUnique({
          include: {
            course: {
              include: courseInclude,
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
