import { prisma } from "@zoonk/db";
import { rejected } from "@zoonk/utils/settled";
import { streamError, streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";

async function saveActivity(activity: LessonActivity, workflowRunId: string): Promise<void> {
  const current = await prisma.activity.findUnique({
    where: { id: activity.id },
  });

  if (current?.generationStatus !== "running") {
    return;
  }

  await prisma.activity.update({
    data: { generationRunId: workflowRunId, generationStatus: "completed" },
    where: { id: activity.id },
  });
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

  if (rejected(results)) {
    await streamError({ reason: "dbSaveFailed", step: "setCustomAsCompleted" });
    await streamStatus({ status: "error", step: "setActivityAsCompleted" });
    return;
  }

  await streamStatus({ status: "completed", step: "setCustomAsCompleted" });
  await streamStatus({ status: "completed", step: "setActivityAsCompleted" });
}
