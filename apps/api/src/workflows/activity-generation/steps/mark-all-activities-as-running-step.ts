import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Marks all activities as "running" in a single database transaction
 * at the start of the workflow. This prevents a race condition where
 * a user navigates to a still-"pending" activity and triggers a
 * duplicate workflow. Previously only 3 of 10 activity kinds called
 * `setActivityAsRunningStep` individually — now all are marked
 * in one batch before any generation begins.
 *
 * Also deletes existing steps for failed activities in the same
 * transaction, so they start fresh. The caller is responsible for
 * filtering — this step receives ONLY activities that need generation
 * (pending or failed), never completed or running ones.
 */
export async function markAllActivitiesAsRunningStep({
  activities,
  workflowRunId,
}: {
  activities: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "setActivityAsRunning" });

  if (activities.length === 0) {
    await stream.status({ status: "completed", step: "setActivityAsRunning" });
    return;
  }

  const failedActivityIds = activities
    .filter((activity) => activity.generationStatus === "failed")
    .map((activity) => activity.id);

  const allActivityIds = activities.map((activity) => activity.id);

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      ...(failedActivityIds.length > 0
        ? [prisma.step.deleteMany({ where: { activityId: { in: failedActivityIds } } })]
        : []),
      ...allActivityIds.map((id) =>
        prisma.activity.update({
          data: {
            generationRunId: workflowRunId,
            generationStatus: "running",
          },
          where: { id },
        }),
      ),
    ]),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "setActivityAsRunning" });
}
