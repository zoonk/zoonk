import { prisma } from "@zoonk/db";
import { type LessonActivity } from "../activity-generation/steps/get-lesson-activities-step";

/**
 * Re-fetches lesson activities from the database with the same shape
 * that getLessonActivitiesStep returns. Used in step integration tests
 * to build the `activities` input that real steps expect.
 */
export async function fetchLessonActivities(lessonId: number): Promise<LessonActivity[]> {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: { chapter: { include: { course: { include: { organization: true } } } } },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}
