import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";

const NEIGHBOR_RANGE = 3;

async function getNeighboringLessonConcepts(chapterId: number, position: number) {
  return prisma.lesson.findMany({
    select: { concepts: true },
    where: {
      chapterId,
      position: {
        gte: position - NEIGHBOR_RANGE,
        lte: position + NEIGHBOR_RANGE,
        not: position,
      },
    },
  });
}

async function getLessonActivities(lessonId: number) {
  const activities = await prisma.activity.findMany({
    orderBy: { position: "asc" },
    select: {
      _count: { select: { steps: true } },
      description: true,
      generationStatus: true,
      id: true,
      kind: true,
      language: true,
      lesson: {
        select: {
          chapter: {
            select: {
              course: {
                select: {
                  organization: { select: { id: true, slug: true } },
                  targetLanguage: true,
                  title: true,
                },
              },
              title: true,
            },
          },
          chapterId: true,
          concepts: true,
          description: true,
          kind: true,
          position: true,
          title: true,
        },
      },
      lessonId: true,
      title: true,
    },
    where: { lessonId },
  });

  if (activities.length === 0) {
    return [];
  }

  const firstLesson = activities[0]?.lesson;

  if (!firstLesson) {
    return [];
  }

  const neighboringLessons = await getNeighboringLessonConcepts(
    firstLesson.chapterId,
    firstLesson.position,
  );
  const neighboringConcepts = [
    ...new Set(
      neighboringLessons.flatMap((lesson) =>
        lesson.concepts.map((concept) => concept.trim()).filter((concept) => concept.length > 0),
      ),
    ),
  ];

  return activities.map((activity) => ({
    ...activity,
    id: Number(activity.id),
    lesson: {
      ...activity.lesson,
      neighboringConcepts,
    },
  }));
}

export type LessonActivity = Awaited<ReturnType<typeof getLessonActivities>>[number];

export async function getLessonActivitiesStep(lessonId: number): Promise<LessonActivity[]> {
  "use step";

  await streamStatus({ status: "started", step: "getLessonActivities" });

  const { data: activities, error } = await safeAsync(() => getLessonActivities(lessonId));

  if (error) {
    await streamError({ reason: "dbFetchFailed", step: "getLessonActivities" });
    throw error;
  }

  if (activities.length === 0) {
    await streamError({ reason: "noSourceData", step: "getLessonActivities" });
    throw new FatalError("No activities found for lesson");
  }

  await streamStatus({ status: "completed", step: "getLessonActivities" });

  return activities;
}
