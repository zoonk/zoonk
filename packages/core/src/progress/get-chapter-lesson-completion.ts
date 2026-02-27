import { prisma } from "@zoonk/db";
import { getChapterLessonCompletion as query } from "@zoonk/db/completion/chapter-lessons";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

export async function getChapterLessonCompletion({
  chapterId,
  headers,
}: {
  chapterId: number;
  headers?: Headers;
}): Promise<
  {
    completedActivities: number;
    lessonId: number;
    totalActivities: number;
  }[]
> {
  const session = await getSession(headers);
  const userId = session ? Number(session.user.id) : 0;

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
