import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type SetLessonAsRunningInput = {
  lessonId: string;
  resetExistingSteps?: boolean;
  workflowRunId: string;
};

/**
 * Failed lesson retries need to clear any partial steps from the previous run,
 * while normal pending lessons should keep the write to a single status update.
 */
function buildRunningTransaction(input: SetLessonAsRunningInput) {
  return [
    ...(input.resetExistingSteps
      ? [prisma.step.deleteMany({ where: { lessonId: input.lessonId } })]
      : []),
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      where: { id: input.lessonId },
    }),
  ];
}

export async function setLessonAsRunningStep(input: SetLessonAsRunningInput): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsRunning" });

  const { error } = await safeAsync(() => prisma.$transaction(buildRunningTransaction(input)));

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "setLessonAsRunning" });
}
