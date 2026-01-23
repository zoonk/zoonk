import "server-only";
import { type BatchPayload, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type AddParams = {
  courseId: number;
  categories: string[];
};

export async function addCourseCategories(
  params: AddParams,
): Promise<SafeReturn<BatchPayload | null>> {
  const categories = params.categories.map((category) => ({
    category,
    courseId: params.courseId,
  }));

  const { data, error } = await safeAsync(() =>
    prisma.courseCategory.createMany({
      data: categories,
      skipDuplicates: true,
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
