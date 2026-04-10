import { getActiveActivityWhere, prisma } from "@zoonk/db";

/**
 * Workflow steps and workflow test helpers both need the same "current lesson
 * activities" view. Keeping that query in one place prevents archived
 * activities or archived ancestors from leaking back into generation context
 * when one caller gets updated and the other does not.
 */
export async function fetchLessonActivities(lessonId: number) {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: getActiveActivityWhere({
      activityWhere: { lessonId },
    }),
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}
