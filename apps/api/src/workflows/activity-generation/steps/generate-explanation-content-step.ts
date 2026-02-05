import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps, parseActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateExplanationContentStep(
  activities: LessonActivity[],
  backgroundSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const activity = activities.find((a) => a.kind === "explanation");
  if (!activity) {
    return { steps: [] };
  }

  // Dependency check: explanation needs background
  if (backgroundSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  // Resume: check if steps already exist in DB
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true },
      where: { activityId: activity.id },
    }),
  );

  if (existingSteps && existingSteps.length > 0) {
    return { steps: parseActivitySteps(existingSteps) };
  }

  await streamStatus({ status: "started", step: "generateExplanationContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityExplanation({
      backgroundSteps,
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateExplanationContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  const steps = result.data.steps;

  if (steps.length === 0) {
    await streamStatus({ status: "error", step: "generateExplanationContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  // Save steps to DB immediately
  const { error: saveError } = await safeAsync(() =>
    prisma.step.createMany({
      data: steps.map((step, index) => ({
        activityId: activity.id,
        content: { text: step.text, title: step.title },
        kind: "static" as const,
        position: index,
      })),
    }),
  );

  if (saveError) {
    await handleActivityFailureStep({ activityId: activity.id });
    await streamStatus({ status: "error", step: "generateExplanationContent" });
    return { steps: [] };
  }

  await streamStatus({ status: "completed", step: "generateExplanationContent" });

  return { steps };
}
