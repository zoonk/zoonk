import { getActiveActivityWhere, prisma } from "@zoonk/db";

/**
 * Workflow steps and workflow test helpers both need the same "current lesson
 * activities" view. Keeping that query in one place prevents archived
 * activities or archived ancestors from leaking back into generation context
 * when one caller gets updated and the other does not.
 */
export async function fetchLessonActivities(lessonId: number) {
  return fetchActivitiesForLesson({
    lessonId,
    replacementActivities: false,
  });
}

/**
 * Regeneration builds one hidden replacement set under the live lesson.
 * This helper loads only that unpublished set so the background workflow can
 * regenerate activities without touching the published learner-facing ones.
 */
export async function fetchReplacementLessonActivities(input: { lessonId: number }) {
  return fetchActivitiesForLesson({
    lessonId: input.lessonId,
    replacementActivities: true,
  });
}

/**
 * Workflow steps and workflow test helpers both need the same activity query
 * shape. This helper keeps the includes and ordering in one place while the
 * caller chooses whether it wants the published lesson content or the hidden
 * replacement set used during regeneration.
 */
async function fetchActivitiesForLesson(input: {
  lessonId: number;
  replacementActivities: boolean;
}) {
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
      activityWhere: input.replacementActivities
        ? {
            isPublished: false,
            lessonId: input.lessonId,
          }
        : {
            lessonId: input.lessonId,
          },
    }),
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}
