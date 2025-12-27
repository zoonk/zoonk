import "server-only";

import { prisma } from "@zoonk/db";
import { toSlug } from "@zoonk/utils/string";

export async function addAlternativeTitles(params: {
  courseId: number;
  titles: string[];
  locale: string;
}): Promise<void> {
  const slugs = params.titles.map((title) => toSlug(title));
  const uniqueSlugs = [...new Set(slugs)].filter(Boolean);

  if (uniqueSlugs.length === 0) {
    return;
  }

  await prisma.courseAlternativeTitle.createMany({
    data: uniqueSlugs.map((slug) => ({
      courseId: params.courseId,
      locale: params.locale,
      slug,
    })),
    skipDuplicates: true,
  });
}
