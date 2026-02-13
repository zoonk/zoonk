import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "../get-lesson-activities-step";
import { findActivityByKind } from "./find-activity-by-kind";
import { type ActivitySteps, parseActivitySteps } from "./get-activity-steps";

/**
 * Resume from DB: returns existing steps if found, null otherwise.
 */
async function getExistingContentSteps(activityId: bigint | number): Promise<ActivitySteps | null> {
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
 * Resolves the activity for a given kind and handles status-based branching.
 * Returns `shouldGenerate: true` when the step should proceed with AI generation,
 * or `shouldGenerate: false` with existing steps (possibly empty) when it should skip.
 */
export async function resolveActivityForGeneration(
  activities: LessonActivity[],
  kind: ActivityKind,
): Promise<
  | { activity: LessonActivity; shouldGenerate: true; existingSteps?: undefined }
  | { activity?: undefined; shouldGenerate: false; existingSteps: ActivitySteps }
> {
  const activity = findActivityByKind(activities, kind);

  if (!activity) {
    return { existingSteps: [], shouldGenerate: false };
  }

  if (activity.generationStatus === "completed") {
    return {
      existingSteps: (await getExistingContentSteps(activity.id)) ?? [],
      shouldGenerate: false,
    };
  }

  if (activity.generationStatus === "running") {
    return { existingSteps: [], shouldGenerate: false };
  }

  if (activity.generationStatus === "failed") {
    await prisma.step.deleteMany({ where: { activityId: activity.id } });
  }

  return { activity, shouldGenerate: true };
}

/**
 * Save generated steps to DB.
 * Returns null on success, error on failure.
 */
export async function saveContentSteps(
  activityId: bigint | number,
  steps: ActivitySteps,
): Promise<{ error: Error | null }> {
  if (steps.length === 0) {
    return { error: new Error("No steps to save") };
  }

  return safeAsync(() =>
    prisma.step.createMany({
      data: steps.map((step, index) => ({
        activityId,
        content: assertStepContent("static", {
          text: step.text,
          title: step.title,
          variant: "text",
        }),
        isPublished: true,
        kind: "static" as const,
        position: index,
      })),
    }),
  );
}
