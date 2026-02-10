import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { prisma } from "@zoonk/db";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";

async function saveActivity(activity: LessonActivity, workflowRunId: string): Promise<boolean> {
  const current = await prisma.activity.findUnique({
    select: { generationStatus: true },
    where: { id: activity.id },
  });

  if (current?.generationStatus !== "running") {
    return true;
  }

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (error) {
    return false;
  }

  await revalidateMainApp([cacheTagActivity({ activityId: BigInt(activity.id) })]);
  return true;
}

export async function saveCustomActivitiesStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const customActivities = activities.filter((act) => act.kind === "custom");

  if (customActivities.length === 0) {
    return;
  }

  await streamStatus({ status: "started", step: "setCustomAsCompleted" });
  await streamStatus({ status: "started", step: "setActivityAsCompleted" });

  const results = await Promise.allSettled(
    customActivities.map((act) => saveActivity(act, workflowRunId)),
  );

  const hasFailure = results.some(
    (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value),
  );

  if (hasFailure) {
    await streamError({ reason: "dbSaveFailed", step: "setCustomAsCompleted" });
    await streamStatus({ status: "error", step: "setActivityAsCompleted" });
    return;
  }

  await streamStatus({ status: "completed", step: "setCustomAsCompleted" });
  await streamStatus({ status: "completed", step: "setActivityAsCompleted" });
}
