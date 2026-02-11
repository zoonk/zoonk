import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function getLessonActivityCompletion(
  userId: number,
  lessonId: number,
): Promise<string[]> {
  if (userId === 0) {
    return [];
  }

  const { data, error } = await safeAsync(() =>
    prisma.activityProgress.findMany({
      select: { activityId: true },
      where: {
        activity: { isPublished: true, lessonId },
        completedAt: { not: null },
        userId,
      },
    }),
  );

  if (error || !data) {
    return [];
  }

  return data.map((row) => String(row.activityId));
}
