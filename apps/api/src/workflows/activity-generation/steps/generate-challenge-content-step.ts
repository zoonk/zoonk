import {
  type StepStream,
  type WorkflowErrorReason,
  createStepStream,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import {
  type ActivityChallengeSchema,
  generateActivityChallenge,
} from "@zoonk/ai/tasks/activities/core/challenge";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
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
  stream: StepStream<ActivityStepName>,
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await stream.error({ reason, step: "generateChallengeContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveAndCompleteChallenge(
  stream: StepStream<ActivityStepName>,
  activityId: bigint | number,
  data: ActivityChallengeSchema,
): Promise<void> {
  const { error } = await saveChallengeSteps(activityId, data);

  if (error) {
    await handleChallengeError(stream, activityId, "dbSaveFailed");
    return;
  }

  await stream.status({ status: "completed", step: "generateChallengeContent" });
}

export async function generateChallengeContentStep(
  activities: LessonActivity[],
  concepts: string[],
  neighboringConcepts: string[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "challenge");

  if (!resolved.shouldGenerate) {
    return;
  }

  const { activity } = resolved;

  if (concepts.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateChallengeContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityChallengeSchema }> = await safeAsync(
    () =>
      generateActivityChallenge({
        chapterTitle: activity.lesson.chapter.title,
        concepts,
        courseTitle: activity.lesson.chapter.course.title,
        language: activity.language,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        neighboringConcepts,
      }),
  );

  if (error || !result || result.data.steps.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    await handleChallengeError(stream, activity.id, reason);
    return;
  }

  await saveAndCompleteChallenge(stream, activity.id, result.data);
}
