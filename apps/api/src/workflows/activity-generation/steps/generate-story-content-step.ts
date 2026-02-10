import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityStorySchema,
  generateActivityStory,
} from "@zoonk/ai/tasks/activities/core/story";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

type StoryStep = ActivityStorySchema["steps"][number];

async function saveStorySteps(
  activityId: bigint | number,
  steps: StoryStep[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
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
  );
}

async function handleStoryError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generateStoryContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveAndCompleteStory(
  activityId: bigint | number,
  steps: StoryStep[],
): Promise<void> {
  const { error } = await saveStorySteps(activityId, steps);

  if (error) {
    await handleStoryError(activityId, "dbSaveFailed");
    return;
  }

  await streamStatus({ status: "completed", step: "generateStoryContent" });
}

export async function generateStoryContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<void> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "story");

  if (!resolved.shouldGenerate) {
    return;
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "started", step: "generateStoryContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityStorySchema }> = await safeAsync(() =>
    generateActivityStory({
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
    await handleStoryError(activity.id, reason);
    return;
  }

  await saveAndCompleteStory(activity.id, result.data.steps);
}
