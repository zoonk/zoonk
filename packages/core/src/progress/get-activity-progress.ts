import { getPublishedActivityWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

export async function getActivityProgress({
  lessonId,
  headers,
}: {
  lessonId: number;
  headers?: Headers;
}): Promise<string[]> {
  const session = await getSession(headers);
  const userId = session?.user.id;

  if (!userId) {
    return [];
  }

  const { data: lessonCompletion } = await safeAsync(() =>
    prisma.lessonCompletion.findUnique({
      where: {
        userLessonCompletion: {
          lessonId,
          userId,
        },
      },
    }),
  );

  if (lessonCompletion) {
    const { data: activities } = await safeAsync(() =>
      prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: getPublishedActivityWhere({
          lessonWhere: { id: lessonId },
        }),
      }),
    );

    return (activities ?? []).map((activity) => String(activity.id));
  }

  const { data, error } = await safeAsync(() =>
    prisma.activityProgress.findMany({
      where: {
        activity: getPublishedActivityWhere({
          lessonWhere: { id: lessonId },
        }),
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
