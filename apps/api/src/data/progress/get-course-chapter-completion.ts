import { prisma } from "@zoonk/db";
import { getCourseChapterCompletion as query } from "@zoonk/db/completion/course-chapters";
import { safeAsync } from "@zoonk/utils/error";

export async function getCourseChapterCompletion(
  userId: number,
  courseId: number,
): Promise<
  {
    chapterId: number;
    completedLessons: number;
    totalLessons: number;
  }[]
> {
  if (userId === 0) {
    return [];
  }

  const { data, error } = await safeAsync(() => prisma.$queryRawTyped(query(userId, courseId)));

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    chapterId: row.chapterId,
    completedLessons: row.completedLessons ?? 0,
    totalLessons: row.totalLessons ?? 0,
  }));
}
