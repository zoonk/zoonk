import "server-only";
import { type Activity, getPublishedActivityWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListLessonActivities = cache(
  async (lessonId: string): Promise<Activity[]> =>
    prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: getPublishedActivityWhere({
        activityWhere: { lessonId },
      }),
    }),
);

export function listLessonActivities(params: { lessonId: string }): Promise<Activity[]> {
  return cachedListLessonActivities(params.lessonId);
}
