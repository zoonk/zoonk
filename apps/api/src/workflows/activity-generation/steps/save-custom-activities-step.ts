import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { rejected } from "@zoonk/utils/settled";
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

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "setCustomAsCompleted" });
  await stream.status({ status: "started", step: "setActivityAsCompleted" });

  const results = await Promise.allSettled(
    customActivities.map((act) => saveActivity(act, workflowRunId)),
  );

  const hasFirstActivity = customActivities.some((a) => a.position === 0);

  if (rejected(results)) {
    await stream.error({ reason: "dbSaveFailed", step: "setCustomAsCompleted" });
    await stream.status({ status: "error", step: "setActivityAsCompleted" });

    if (hasFirstActivity) {
      await stream.status({ status: "error", step: "setFirstActivityAsCompleted" });
    }

    return;
  }

  await stream.status({ status: "completed", step: "setCustomAsCompleted" });
  await stream.status({ status: "completed", step: "setActivityAsCompleted" });

  if (hasFirstActivity) {
    await stream.status({ status: "completed", step: "setFirstActivityAsCompleted" });
  }
}
