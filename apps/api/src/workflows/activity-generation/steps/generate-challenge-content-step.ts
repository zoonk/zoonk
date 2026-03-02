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
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

async function saveChallengeSteps(
  activityId: bigint | number,
  data: ActivityChallengeSchema,
): Promise<{ error: Error | null }> {
  const introStep = {
    activityId,
    content: assertStepContent("static", { text: data.intro, title: "", variant: "text" }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };

  const mcSteps = data.steps.map((step, index) => ({
    activityId,
    content: assertStepContent("multipleChoice", {
      context: step.context,
      kind: "challenge",
      options: step.options,
      question: step.question,
    }),
    isPublished: true,
    kind: "multipleChoice" as const,
    position: index + 1,
  }));

  const reflectionStep = {
    activityId,
    content: assertStepContent("static", { text: data.reflection, title: "", variant: "text" }),
    isPublished: true,
    kind: "static" as const,
    position: data.steps.length + 1,
  };

  return safeAsync(() =>
    prisma.step.createMany({
      data: [introStep, ...mcSteps, reflectionStep],
    }),
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
  const { error } = await saveChallengeSteps(activityId, data);

  if (error) {
    await handleChallengeError(activityId, "dbSaveFailed");
    return;
  }

  await streamStatus({ status: "completed", step: "generateChallengeContent" });
}

export async function generateChallengeContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "challenge");

  if (!resolved.shouldGenerate) {
    return;
  }

  const { activity } = resolved;

  await streamStatus({ status: "started", step: "generateChallengeContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityChallengeSchema }> = await safeAsync(
    () =>
      generateActivityChallenge({
        chapterTitle: activity.lesson.chapter.title,
        concepts: activity.lesson.concepts,
        courseTitle: activity.lesson.chapter.course.title,
        language: activity.language,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        neighboringConcepts: activity.lesson.neighboringConcepts,
      }),
  );

  if (error || !result || result.data.steps.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    await handleChallengeError(activity.id, reason);
    return;
  }

  await saveAndCompleteChallenge(activity.id, result.data);
}
