import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "./get-lesson-activities-step";

const NEIGHBOR_RANGE = 3;

async function getNeighboringConcepts(chapterId: number, position: number): Promise<string[]> {
  const neighbors = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
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

  return neighbors.flatMap((lesson) => lesson.concepts);
}

export async function getNeighboringConceptsStep(activities: LessonActivity[]): Promise<string[]> {
  "use step";

  const activity = activities[0];

  if (!activity) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "getNeighboringConcepts" });

  const { data: concepts, error } = await safeAsync(() =>
    getNeighboringConcepts(activity.lesson.chapterId, activity.lesson.position),
  );

  if (error) {
    await stream.error({ reason: "dbFetchFailed", step: "getNeighboringConcepts" });
    return [];
  }

  await stream.status({ status: "completed", step: "getNeighboringConcepts" });

  return concepts;
}
