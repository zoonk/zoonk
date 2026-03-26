import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Checks if the reading source data is available and valid for copying.
 * Returns the reading steps if the reading activity exists and hasn't failed,
 * or null if copying should be aborted.
 */
async function fetchReadingSourceSteps(
  activities: LessonActivity[],
): Promise<{ position: number; sentenceId: bigint | null }[] | null> {
  const reading = findActivityByKind(activities, "reading");

  if (!reading) {
    return null;
  }

  const readingActivity = await prisma.activity.findUnique({
    where: { id: reading.id },
  });

  if (readingActivity?.generationStatus === "failed") {
    return null;
  }

  const readingSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { position: true, sentenceId: true },
    where: { activityId: reading.id, kind: "reading" },
  });

  if (readingSteps.length === 0) {
    return null;
  }

  return readingSteps;
}

/**
 * Creates listening steps from reading steps and marks the activity as completed.
 * Returns true on success, false on failure.
 */
async function createListeningStepsAndComplete(params: {
  listeningId: number;
  readingSteps: { position: number; sentenceId: bigint | null }[];
  workflowRunId: string;
}): Promise<boolean> {
  const { error: saveError } = await safeAsync(() =>
    prisma.step.createMany({
      data: params.readingSteps.map((readingStep) => ({
        activityId: params.listeningId,
        content: assertStepContent("listening", {}),
        isPublished: true,
        kind: "listening" as const,
        position: readingStep.position,
        sentenceId: readingStep.sentenceId,
      })),
    }),
  );

  if (saveError) {
    return false;
  }

  const { error: completeError } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: params.workflowRunId, generationStatus: "completed" },
      where: { id: params.listeningId },
    }),
  );

  return !completeError;
}

/**
 * Copies reading steps to create listening steps, then marks the listening
 * activity as completed. This is the single save+complete point for the
 * listening entity.
 *
 * Listening activities mirror the reading activity's sentences but use
 * the "listening" step kind (audio-only presentation). The copy only
 * proceeds if the reading activity exists and hasn't failed.
 */
export async function saveListeningActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const listening = findActivityByKind(activities, "listening");

  if (!listening) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  const current = await prisma.activity.findUnique({
    where: { id: listening.id },
  });

  if (current?.generationStatus === "completed") {
    return;
  }

  const readingSteps = await fetchReadingSourceSteps(activities);

  if (!readingSteps) {
    await stream.error({ reason: "noSourceData", step: "saveListeningActivity" });
    await handleActivityFailureStep({ activityId: listening.id });
    return;
  }

  await stream.status({ status: "started", step: "saveListeningActivity" });

  const success = await createListeningStepsAndComplete({
    listeningId: listening.id,
    readingSteps,
    workflowRunId,
  });

  if (!success) {
    await stream.error({ reason: "dbSaveFailed", step: "saveListeningActivity" });
    await handleActivityFailureStep({ activityId: listening.id });
    return;
  }

  await stream.status({ status: "completed", step: "saveListeningActivity" });
}
