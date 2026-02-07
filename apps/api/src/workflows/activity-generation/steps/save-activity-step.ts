import { type ActivityStepName } from "@/workflows/config";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { type ActivityKind, prisma } from "@zoonk/db";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";

const kindToStepName: Partial<Record<ActivityKind, ActivityStepName>> = {
  background: "setBackgroundAsCompleted",
  challenge: "setChallengeAsCompleted",
  examples: "setExamplesAsCompleted",
  explanation: "setExplanationAsCompleted",
  mechanics: "setMechanicsAsCompleted",
  quiz: "setQuizAsCompleted",
  review: "setReviewAsCompleted",
  story: "setStoryAsCompleted",
};

export async function saveActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const activity = activities.find((a) => a.kind === activityKind);
  const stepName = kindToStepName[activityKind];

  if (!activity || !stepName) {
    return;
  }

  const current = await prisma.activity.findUnique({
    select: { generationStatus: true },
    where: { id: activity.id },
  });

  const isCompleted = current?.generationStatus === "completed";
  const isFailed = current?.generationStatus === "failed";

  if (isCompleted || isFailed) {
    return;
  }

  await streamStatus({ status: "started", step: stepName });
  await streamStatus({ status: "started", step: "setActivityAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: stepName });
    await streamStatus({ status: "error", step: "setActivityAsCompleted" });
    return;
  }

  await revalidateMainApp([cacheTagActivity({ activityId: BigInt(activity.id) })]);

  await streamStatus({ status: "completed", step: stepName });
  await streamStatus({ status: "completed", step: "setActivityAsCompleted" });
}
