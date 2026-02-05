import { generateActivityMechanics } from "@zoonk/ai/tasks/activities/core/mechanics";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps, parseActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateMechanicsContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const activity = activities.find((a) => a.kind === "mechanics");
  if (!activity) {
    return { steps: [] };
  }

  // Dependency check: mechanics needs explanation
  if (explanationSteps.length === 0) {
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

  await streamStatus({ status: "started", step: "generateMechanicsContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityMechanics({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      explanationSteps,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateMechanicsContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  const steps = result.data.steps;

  if (steps.length === 0) {
    await streamStatus({ status: "error", step: "generateMechanicsContent" });
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
    await streamStatus({ status: "error", step: "generateMechanicsContent" });
    return { steps: [] };
  }

  await streamStatus({ status: "completed", step: "generateMechanicsContent" });

  return { steps };
}
