import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

export async function getLessonActivityCompletion({
  lessonId,
  headers,
}: {
  lessonId: number;
  headers?: Headers;
}): Promise<string[]> {
  const session = await getSession(headers);
  const userId = session ? Number(session.user.id) : 0;

  if (userId === 0) {
    return [];
  }

  const { data, error } = await safeAsync(() =>
    prisma.activityProgress.findMany({
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
