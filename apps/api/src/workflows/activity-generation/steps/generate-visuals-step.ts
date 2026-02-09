import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisual = StepVisualSchema["visuals"][number];

async function saveVisualsToDB(
  visuals: StepVisual[],
  dbSteps: { id: bigint | number }[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    Promise.all(
      visuals.map((visual) => {
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
}

async function handleVisualsError(activityId: bigint | number): Promise<{ visuals: StepVisual[] }> {
  await streamStatus({ status: "error", step: "generateVisuals" });
  await handleActivityFailureStep({ activityId });
  return { visuals: [] };
}

export async function generateVisualsStep(
  activities: LessonActivity[],
  steps: ActivitySteps,
  activityKind: ActivityKind,
): Promise<{ visuals: StepVisual[] }> {
  "use step";

  const activity = findActivityByKind(activities, activityKind);

  if (!activity || steps.length === 0) {
    return { visuals: [] };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { visuals: [] };
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
    where: { activityId: activity.id },
  });

  if (dbSteps.length === 0) {
    return { visuals: [] };
  }

  await streamStatus({ status: "started", step: "generateVisuals" });

  const { data: result, error } = await safeAsync(() =>
    generateStepVisuals({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      steps,
    }),
  );

  if (error || !result) {
    return handleVisualsError(activity.id);
  }

  const { error: saveError } = await saveVisualsToDB(result.data.visuals, dbSteps);

  if (saveError) {
    return handleVisualsError(activity.id);
  }

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return { visuals: result.data.visuals };
}
