import {
  type StepStream,
  type WorkflowErrorReason,
  createStepStream,
} from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { buildVisualRows } from "./_utils/visual-rows";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisual = StepVisualSchema["visuals"][number];

async function saveVisualsToDB(
  data: {
    activityId: bigint | number;
    content: Omit<StepVisual, "stepIndex">;
    isPublished: true;
    kind: "visual";
    position: number;
  }[],
): Promise<{ error: Error | null }> {
  if (data.length === 0) {
    return { error: null };
  }

  return safeAsync(() => prisma.step.createMany({ data }));
}

async function handleVisualsError(
  stream: StepStream<ActivityStepName>,
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<{ visuals: StepVisual[] }> {
  await stream.error({ reason, step: "generateVisuals" });
  await handleActivityFailureStep({ activityId });
  return { visuals: [] };
}

export async function generateVisualsForActivityStep(
  activity: LessonActivity,
  steps: ActivitySteps,
): Promise<{ visuals: StepVisual[] }> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  if (steps.length === 0) {
    await stream.status({ status: "started", step: "generateVisuals" });
    await stream.status({ status: "completed", step: "generateVisuals" });
    return { visuals: [] };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { visuals: [] };
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, position: true },
    where: { activityId: activity.id, kind: "static" },
  });

  if (dbSteps.length === 0) {
    await stream.status({ status: "started", step: "generateVisuals" });
    await stream.status({ status: "completed", step: "generateVisuals" });
    return { visuals: [] };
  }

  await stream.status({ status: "started", step: "generateVisuals" });

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
    const reason = error ? "aiGenerationFailed" : "aiEmptyResult";
    return await handleVisualsError(stream, activity.id, reason);
  }

  const visualRows = buildVisualRows({
    activityId: activity.id,
    dbSteps,
    visuals: result.data.visuals,
  });

  if (!visualRows) {
    return await handleVisualsError(stream, activity.id, "contentValidationFailed");
  }

  const { error: saveError } = await saveVisualsToDB(visualRows);

  if (saveError) {
    return await handleVisualsError(stream, activity.id, "dbSaveFailed");
  }

  await stream.status({ status: "completed", step: "generateVisuals" });

  return { visuals: result.data.visuals };
}
