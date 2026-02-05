import { type ActivityStepName } from "@/workflows/config";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { type ActivityKind, prisma } from "@zoonk/db";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";

const kindToStepName: Partial<Record<ActivityKind, ActivityStepName>> = {
  background: "setBackgroundAsCompleted",
  explanation: "setExplanationAsCompleted",
  mechanics: "setMechanicsAsCompleted",
  quiz: "setQuizAsCompleted",
};

export async function saveActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const activity = activities.find((a) => a.kind === activityKind);
  if (!activity) {
    return;
  }

  const stepName = kindToStepName[activityKind];
  if (!stepName) {
    return;
  }

  const current = await prisma.activity.findUnique({
    select: { generationStatus: true },
    where: { id: activity.id },
  });

  if (current?.generationStatus === "completed") {
    return;
  }
  if (current?.generationStatus === "failed") {
    return;
  }

  await streamStatus({ status: "started", step: stepName });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: stepName });
    return;
  }

  await revalidateMainApp([cacheTagActivity({ activityId: BigInt(activity.id) })]);
  await streamStatus({ status: "completed", step: stepName });
}
