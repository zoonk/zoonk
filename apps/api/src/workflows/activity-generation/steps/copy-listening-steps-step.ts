import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function copyListeningStepsStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const listening = findActivityByKind(activities, "listening");

  if (!listening) {
    return;
  }

  const current = await prisma.activity.findUnique({
    where: { id: listening.id },
  });

  if (current?.generationStatus === "completed" || current?.generationStatus === "running") {
    return;
  }

  if (current?.generationStatus === "failed") {
    await safeAsync(() => prisma.step.deleteMany({ where: { activityId: listening.id } }));
  }

  const reading = findActivityByKind(activities, "reading");

  await using stream = createStepStream<ActivityStepName>();

  if (!reading) {
    await stream.error({ reason: "noSourceData", step: "copyListeningSteps" });
    await handleActivityFailureStep({ activityId: listening.id });
    return;
  }

  const readingSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { position: true, sentenceId: true },
    where: { activityId: reading.id, kind: "reading" },
  });

  await stream.status({ status: "started", step: "copyListeningSteps" });

  if (readingSteps.length === 0) {
    await stream.error({ reason: "noSourceData", step: "copyListeningSteps" });
    await handleActivityFailureStep({ activityId: listening.id });
    return;
  }

  await setActivityAsRunningStep({
    activityId: listening.id,
    workflowRunId,
  });

  const { error } = await safeAsync(() =>
    prisma.step.createMany({
      data: readingSteps.map((readingStep) => ({
        activityId: listening.id,
        content: assertStepContent("listening", {}),
        isPublished: true,
        kind: "listening" as const,
        position: readingStep.position,
        sentenceId: readingStep.sentenceId,
      })),
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "copyListeningSteps" });
    await handleActivityFailureStep({ activityId: listening.id });
    return;
  }

  await stream.status({ status: "completed", step: "copyListeningSteps" });
}
