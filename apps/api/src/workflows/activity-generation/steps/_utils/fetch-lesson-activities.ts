import { getAiGenerationActivityWhere, prisma } from "@zoonk/db";

/**
 * Workflow steps and workflow test helpers both need the same "current lesson
 * activities" view. Keeping that query in one place prevents generation
 * context from drifting when one caller gets updated and the other does not.
 */
export async function fetchLessonActivities(lessonId: string) {
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
    where: getAiGenerationActivityWhere({
      activityWhere: { lessonId },
    }),
  });

  return activities;
}
