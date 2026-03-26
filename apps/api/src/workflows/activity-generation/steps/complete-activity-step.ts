import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { getActivityCompletionStep } from "@zoonk/core/workflow-steps";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { rejected } from "@zoonk/utils/settled";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

async function completeSingleActivity(
  activity: LessonActivity,
  workflowRunId: string,
): Promise<void> {
  const current = await prisma.activity.findUnique({
    where: { id: activity.id },
  });

  if (current?.generationStatus !== "running") {
    return;
  }

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (error) {
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }
}

/**
 * Streams the completion SSE event for activities that are already completed.
 * Used by the activity-generation-workflow when all activities are done
 * so the client can detect completion and redirect.
 *
 * For the normal generation flow, each save step (saveQuizActivity, etc.)
 * handles its own completion. This step only exists for the re-streaming case.
 */
export async function completeActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const matchingActivities = findActivitiesByKind(activities, activityKind);
  const stepName = getActivityCompletionStep(activityKind);

  if (matchingActivities.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: stepName });

  const allSettled = await Promise.allSettled(
    matchingActivities.map((activity) => completeSingleActivity(activity, workflowRunId)),
  );

  const status = rejected(allSettled) ? "error" : "completed";

  await stream.status({ status, step: stepName });
}
