import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";
import { cache } from "react";

export const findAlternativeTitle = cache(
  async (params: {
    title: string;
    locale: string;
  }): Promise<{ slug: string; language: string } | null> => {
    const slug = toSlug(params.title);

    const result = await prisma.courseAlternativeTitle.findUnique({
      select: {
        course: {
          select: {
            language: true,
            organization: { select: { slug: true } },
            slug: true,
          },
        },
      },
      where: { localeSlug: { locale: params.locale, slug } },
    });

    if (!result || result.course.organization.slug !== AI_ORG_SLUG) {
      return null;
    }

    return { language: result.course.language, slug: result.course.slug };
  },
);
