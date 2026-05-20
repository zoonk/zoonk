import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";

type SetLessonAsRunningInput = {
  lessonId: string;
  resetExistingSteps?: boolean;
  workflowRunId: string;
};

type LessonGenerationClaimResult = "claimed" | "skipped";

/**
 * Failed lesson retries need to clear any partial steps from the previous run,
 * while normal pending lessons should keep the write to a single status update.
 */
function getClaimableGenerationStatus(input: SetLessonAsRunningInput) {
  return input.resetExistingSteps ? "failed" : "pending";
}

/**
 * Claims a lesson before any AI work starts. The status predicate makes the
 * claim atomic: if an early preload and completion fallback race, only one run
 * can move the lesson into `running`, and the loser leaves existing steps alone.
 */
async function claimLessonGeneration(
  input: SetLessonAsRunningInput,
): Promise<LessonGenerationClaimResult> {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.lesson.updateMany({
      data: { generationRunId: input.workflowRunId, generationStatus: "running" },
      where: { generationStatus: getClaimableGenerationStatus(input), id: input.lessonId },
    });

    if (claim.count === 0) {
      return "skipped";
    }

    if (input.resetExistingSteps) {
      await tx.step.deleteMany({ where: { lessonId: input.lessonId } });
    }

    return "claimed";
  });
}

export async function setLessonAsRunningStep(
  input: SetLessonAsRunningInput,
): Promise<LessonGenerationClaimResult> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsRunning" });

  const result = await claimLessonGeneration(input);

  await stream.status({ status: "completed", step: "setLessonAsRunning" });

  return result;
}
