import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityPracticeSchema,
  generateActivityPractice,
} from "@zoonk/ai/tasks/activities/core/practice";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

type PracticeStep = ActivityPracticeSchema["steps"][number];

async function savePracticeSteps(
  activityId: bigint | number,
  steps: PracticeStep[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: steps.map((step, index) => {
        const content = assertStepContent("multipleChoice", {
          context: step.context,
          kind: "core",
          options: step.options,
          question: step.question,
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

async function handlePracticeError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generatePracticeContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveAndCompletePractice(
  activityId: bigint | number,
  steps: PracticeStep[],
): Promise<void> {
  const { error } = await savePracticeSteps(activityId, steps);

  if (error) {
    await handlePracticeError(activityId, "dbSaveFailed");
    return;
  }

  await streamStatus({ status: "completed", step: "generatePracticeContent" });
}

export async function generatePracticeContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
  practiceIndex = 0,
): Promise<void> {
  "use step";

  const practiceActivity = findActivitiesByKind(activities, "practice")[practiceIndex];

  if (!practiceActivity) {
    return;
  }

  const resolved = await resolveActivityForGeneration(practiceActivity);

  if (!resolved.shouldGenerate) {
    return;
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "started", step: "generatePracticeContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityPracticeSchema }> = await safeAsync(
    () =>
      generateActivityPractice({
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
    await handlePracticeError(activity.id, reason);
    return;
  }

  await saveAndCompletePractice(activity.id, result.data.steps);
}
