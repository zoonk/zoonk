import "server-only";
import { type Activity, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListLessonActivities = cache(
  async (lessonId: number): Promise<Activity[]> =>
    prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { isPublished: true, lessonId },
    }),
);

export function listLessonActivities(params: { lessonId: number }): Promise<Activity[]> {
  return cachedListLessonActivities(params.lessonId);
}
