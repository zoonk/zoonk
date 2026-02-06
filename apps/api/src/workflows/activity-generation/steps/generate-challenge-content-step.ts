import {
  type ActivityChallengeSchema,
  generateActivityChallenge,
} from "@zoonk/ai/tasks/activities/core/challenge";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

async function saveChallengeSteps(
  activityId: bigint | number,
  steps: ActivityChallengeSchema["steps"][number][],
  activityContent: { intro: string; reflection: string },
): Promise<{ error: Error | null }> {
  return safeAsync(async () => {
    await prisma.step.createMany({
      data: steps.map((step, index) => ({
        activityId,
        content: { context: step.context, options: step.options, question: step.question },
        kind: "multipleChoice",
        position: index,
      })),
    });

    await prisma.activity.update({
      data: { content: activityContent },
      where: { id: activityId },
    });
  });
}

async function handleChallengeError(activityId: bigint | number): Promise<void> {
  await streamStatus({ status: "error", step: "generateChallengeContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveAndCompleteChallenge(
  activityId: bigint | number,
  data: ActivityChallengeSchema,
): Promise<void> {
  const { error } = await saveChallengeSteps(activityId, data.steps, {
    intro: data.intro,
    reflection: data.reflection,
  });

  if (error) {
    await handleChallengeError(activityId);
    return;
  }

  await streamStatus({ status: "completed", step: "generateChallengeContent" });
}

export async function generateChallengeContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<void> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "challenge");

  if (!resolved.shouldGenerate) {
    return;
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "started", step: "generateChallengeContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityChallengeSchema }> = await safeAsync(
    () =>
      generateActivityChallenge({
        chapterTitle: activity.lesson.chapter.title,
        courseTitle: activity.lesson.chapter.course.title,
        explanationSteps,
        language: activity.language,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
      }),
  );

  if (error || !result || result.data.steps.length === 0) {
    await handleChallengeError(activity.id);
    return;
  }

  await saveAndCompleteChallenge(activity.id, result.data);
}
