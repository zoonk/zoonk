import "server-only";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function deleteAICourse(courseId: number): Promise<SafeReturn<void>> {
  const { error } = await safeAsync(() =>
    prisma.course.delete({
      where: { id: courseId },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
