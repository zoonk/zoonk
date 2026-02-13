import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityReviewSchema,
  generateActivityReview,
} from "@zoonk/ai/tasks/activities/core/review";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

type ReviewQuestion = ActivityReviewSchema["questions"][number];

async function saveReviewSteps(
  activityId: bigint | number,
  questions: ReviewQuestion[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: questions.map((question, index) => {
        const content = assertStepContent("multipleChoice", {
          context: question.context,
          kind: "core",
          options: question.options,
          question: question.question,
        });

        return {
          activityId,
          content,
          isPublished: true,
          kind: "multipleChoice",
          position: index,
        };
      }),
    }),
  );
}

async function handleReviewError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generateReviewContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveAndCompleteReview(
  activityId: bigint | number,
  questions: ReviewQuestion[],
): Promise<void> {
  const { error } = await saveReviewSteps(activityId, questions);

  if (error) {
    await handleReviewError(activityId, "dbSaveFailed");
    return;
  }

  await streamStatus({ status: "completed", step: "generateReviewContent" });
}

export async function generateReviewContentStep(
  activities: LessonActivity[],
  backgroundSteps: ActivitySteps,
  explanationSteps: ActivitySteps,
  mechanicsSteps: ActivitySteps,
  examplesSteps: ActivitySteps,
  workflowRunId: string,
): Promise<void> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "review");

  if (!resolved.shouldGenerate) {
    return;
  }

  const { activity } = resolved;

  if (
    backgroundSteps.length === 0 ||
    explanationSteps.length === 0 ||
    mechanicsSteps.length === 0 ||
    examplesSteps.length === 0
  ) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "started", step: "generateReviewContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityReviewSchema }> = await safeAsync(() =>
    generateActivityReview({
      backgroundSteps,
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      examplesSteps,
      explanationSteps,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      mechanicsSteps,
    }),
  );

  if (error || !result || result.data.questions.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    await handleReviewError(activity.id, reason);
    return;
  }

  await saveAndCompleteReview(activity.id, result.data.questions);
}
