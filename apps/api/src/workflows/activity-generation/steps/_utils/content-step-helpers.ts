import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type ActivityStepName } from "../../../config";
import { streamStatus } from "../../stream-status";
import { handleActivityFailureStep } from "../handle-failure-step";
import { type ActivitySteps, parseActivitySteps } from "./get-activity-steps";

/**
 * Resume from DB: returns existing steps if found, null otherwise.
 */
export async function getExistingContentSteps(activityId: bigint): Promise<ActivitySteps | null> {
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true },
      where: { activityId },
    }),
  );

  if (existingSteps && existingSteps.length > 0) {
    return parseActivitySteps(existingSteps);
  }

  return null;
}

/**
 * Save generated steps to DB and stream status.
 * Returns the steps on success, empty array on failure.
 */
export async function saveContentSteps(
  activityId: bigint,
  steps: ActivitySteps,
  stepName: ActivityStepName,
): Promise<ActivitySteps> {
  if (steps.length === 0) {
    await streamStatus({ status: "error", step: stepName });
    await handleActivityFailureStep({ activityId });
    return [];
  }

  const { error } = await safeAsync(() =>
    prisma.step.createMany({
      data: steps.map((step, index) => ({
        activityId,
        content: { text: step.text, title: step.title },
        kind: "static" as const,
        position: index,
      })),
    }),
  );

  if (error) {
    await handleActivityFailureStep({ activityId });
    await streamStatus({ status: "error", step: stepName });
    return [];
  }

  await streamStatus({ status: "completed", step: stepName });
  return steps;
}
