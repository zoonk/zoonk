import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";

type ExistingCourse = {
  id: number;
  slug: string;
  generationStatus: string;
};

export async function findExistingCourse(params: {
  title: string;
  locale: string;
}): Promise<ExistingCourse | null> {
  const slug = toSlug(params.title);

  const course = await prisma.course.findFirst({
    select: { generationStatus: true, id: true, slug: true },
    where: {
      language: params.locale,
      organization: { slug: AI_ORG_SLUG },
      slug,
    },
  });

  if (course) {
    return course;
  }

  const altTitle = await prisma.courseAlternativeTitle.findUnique({
    select: {
      course: {
        select: {
          generationStatus: true,
          id: true,
          organization: { select: { slug: true } },
          slug: true,
        },
      },
    },
    where: { localeSlug: { locale: params.locale, slug } },
  });

  if (altTitle?.course.organization.slug === AI_ORG_SLUG) {
    return {
      generationStatus: altTitle.course.generationStatus,
      id: altTitle.course.id,
      slug: altTitle.course.slug,
    };
  }

  return null;
}
