import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityChallengeSchema,
  generateActivityChallenge,
} from "@zoonk/ai/tasks/activities/core/challenge";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
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
  return safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({
        data: steps.map((step, index) => {
          const content = assertStepContent("multipleChoice", {
            context: step.context,
            options: step.options,
            question: step.question,
          });

          return {
            activityId,
            content,
            kind: "multipleChoice",
            position: index,
          };
        }),
      }),
      prisma.activity.update({
        data: { content: activityContent },
        where: { id: activityId },
      }),
    ]),
  );
}

async function handleChallengeError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generateChallengeContent" });
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
    await handleChallengeError(activityId, "dbSaveFailed");
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
    const reason = getAIResultErrorReason(error, result);
    await handleChallengeError(activity.id, reason);
    return;
  }

  await saveAndCompleteChallenge(activity.id, result.data);
}
