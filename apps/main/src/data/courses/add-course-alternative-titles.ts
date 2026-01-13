import "server-only";

import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";

type AddParams = {
  courseId: number;
  language: string;
  titles: string[];
};

export async function addCourseAlternativeTitles(
  params: AddParams,
): Promise<SafeReturn<void>> {
  const data = params.titles.map((title) => ({
    courseId: params.courseId,
    language: params.language,
    slug: toSlug(title),
  }));

  const { error } = await safeAsync(() =>
    prisma.courseAlternativeTitle.createMany({
      data,
      skipDuplicates: true,
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
