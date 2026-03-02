import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { settledValues } from "@zoonk/utils/settled";
import { streamStatus } from "../stream-status";
import { type CustomContentResult } from "./generate-custom-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type CustomVisualResult = {
  activityId: number;
  visuals: StepVisualSchema["visuals"][number][];
};

async function generateVisualsForActivity(
  activity: LessonActivity,
  contentResult: CustomContentResult,
): Promise<CustomVisualResult> {
  const empty = { activityId: activity.id, visuals: [] };

  if (contentResult.steps.length === 0) {
    return empty;
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return empty;
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
    where: { activityId: activity.id },
  });

  if (dbSteps.length === 0) {
    return empty;
  }

  const { data: result, error } = await safeAsync(() =>
    generateStepVisuals({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      steps: contentResult.steps,
    }),
  );

  if (error || !result) {
    await handleActivityFailureStep({ activityId: activity.id });
    return empty;
  }

  const { error: saveError } = await safeAsync(() =>
    Promise.all(
      result.data.visuals.map((visual) => {
        const dbStep = dbSteps[visual.stepIndex];
        if (!dbStep) {
          return Promise.resolve();
        }
        const { stepIndex: _, kind: __, ...visualContent } = visual;
        return prisma.step.update({
          data: { visualContent, visualKind: visual.kind },
          where: { id: dbStep.id },
        });
      }),
    ),
  );

  if (saveError) {
    await handleActivityFailureStep({ activityId: activity.id });
    return empty;
  }

  return { activityId: activity.id, visuals: result.data.visuals };
}

export async function generateCustomVisualsStep(
  activities: LessonActivity[],
  customContentResults: CustomContentResult[],
): Promise<CustomVisualResult[]> {
  "use step";

  if (customContentResults.length === 0) {
    return [];
  }

  await streamStatus({ status: "started", step: "generateVisuals" });

  const results = await Promise.allSettled(
    customContentResults.map((contentResult) => {
      const activity = activities.find((act) => act.id === contentResult.activityId);
      if (!activity) {
        return Promise.resolve({ activityId: contentResult.activityId, visuals: [] });
      }
      return generateVisualsForActivity(activity, contentResult);
    }),
  );

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return settledValues(results);
}
