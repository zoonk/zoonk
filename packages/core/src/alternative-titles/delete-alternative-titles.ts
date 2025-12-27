import "server-only";

import { prisma } from "@zoonk/db";
import { toSlug } from "@zoonk/utils/string";

export async function deleteAlternativeTitles(params: {
  courseId: number;
  titles: string[];
}): Promise<void> {
  const slugs = params.titles.map((title) => toSlug(title));

  if (slugs.length === 0) {
    return;
  }

  await prisma.courseAlternativeTitle.deleteMany({
    where: {
      courseId: params.courseId,
      slug: { in: slugs },
    },
  });
}
