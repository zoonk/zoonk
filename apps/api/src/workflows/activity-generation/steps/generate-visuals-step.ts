import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { type ActivityKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisual = StepVisualSchema["visuals"][number];

export async function generateVisualsStep(
  activities: LessonActivity[],
  steps: ActivitySteps,
  activityKind: ActivityKind,
): Promise<{ visuals: StepVisual[] }> {
  "use step";

  const activity = activities.find((a) => a.kind === activityKind);

  if (!activity || steps.length === 0) {
    return { visuals: [] };
  }

  if (activity.generationStatus === "completed") {
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

  if (error) {
    await streamStatus({ status: "error", step: "generateVisuals" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return { visuals: result.data.visuals };
}
