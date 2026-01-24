import "server-only";
import { type BatchPayload, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";

export async function addAlternativeTitles(params: {
  courseId: number;
  titles: string[];
  language: string;
}): Promise<SafeReturn<BatchPayload | null>> {
  const slugs = params.titles.map((title) => toSlug(title));
  const uniqueSlugs = [...new Set(slugs)].filter(Boolean);

  if (uniqueSlugs.length === 0) {
    return { data: null, error: null };
  }

  const { data, error } = await safeAsync(() =>
    prisma.courseAlternativeTitle.createMany({
      data: uniqueSlugs.map((slug) => ({
        courseId: params.courseId,
        language: params.language,
        slug,
      })),
      skipDuplicates: true,
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
