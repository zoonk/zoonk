import { prisma } from "@zoonk/db";
import { getCourseChapterCompletion as query } from "@zoonk/db/completion/course-chapters";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

export async function getChapterProgress({
  courseId,
  headers,
}: {
  courseId: number;
  headers?: Headers;
}): Promise<
  {
    chapterId: number;
    completedLessons: number;
    totalLessons: number;
  }[]
> {
  const session = await getSession(headers);
  const userId = session ? Number(session.user.id) : 0;

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
