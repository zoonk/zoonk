import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { prisma } from "@zoonk/db";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";

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

  await Promise.allSettled(
    customActivities.map(async (activity) => {
      const current = await prisma.activity.findUnique({
        select: { generationStatus: true },
        where: { id: activity.id },
      });

      if (current?.generationStatus !== "running") {
        return;
      }

      await prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: activity.id },
      });

      await revalidateMainApp([cacheTagActivity({ activityId: BigInt(activity.id) })]);
    }),
  );

  await streamStatus({ status: "completed", step: "setCustomAsCompleted" });
  await streamStatus({ status: "completed", step: "setActivityAsCompleted" });
}
