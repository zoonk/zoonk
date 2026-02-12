import { prisma } from "@zoonk/db";
import { getChapterLessonCompletion as query } from "@zoonk/db/completion/chapter-lessons";
import { safeAsync } from "@zoonk/utils/error";

export async function getChapterLessonCompletion(
  userId: number,
  chapterId: number,
): Promise<
  {
    completedActivities: number;
    lessonId: number;
    totalActivities: number;
  }[]
> {
  if (userId === 0) {
    return [];
  }

  const { data, error } = await safeAsync(() => prisma.$queryRawTyped(query(userId, chapterId)));

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    completedActivities: row.completedActivities ?? 0,
    lessonId: row.lessonId,
    totalActivities: row.totalActivities ?? 0,
  }));
}
