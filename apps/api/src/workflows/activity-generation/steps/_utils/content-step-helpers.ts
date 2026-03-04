import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "../get-lesson-activities-step";
import { findActivityByKind } from "./find-activity-by-kind";
import { type ActivitySteps, parseActivitySteps } from "./get-activity-steps";

type ShouldGenerate =
  | { activity: LessonActivity; shouldGenerate: true; existingSteps?: undefined }
  | { activity?: undefined; shouldGenerate: false; existingSteps: ActivitySteps };

async function getExistingContentSteps(activityId: bigint | number): Promise<ActivitySteps> {
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true },
      where: { activityId },
    }),
  );

  if (!existingSteps?.length) {
    return [];
  }

  try {
    return parseActivitySteps(existingSteps);
  } catch {
    return [];
  }
}

async function resolveActivity(activity: LessonActivity): Promise<ShouldGenerate> {
  if (activity.generationStatus === "completed") {
    return {
      existingSteps: await getExistingContentSteps(activity.id),
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

export async function resolveActivityForGeneration(
  activitiesOrActivity: LessonActivity[] | LessonActivity,
  kind?: ActivityKind,
): Promise<ShouldGenerate> {
  if (!Array.isArray(activitiesOrActivity)) {
    return resolveActivity(activitiesOrActivity);
  }

  const activity = kind ? findActivityByKind(activitiesOrActivity, kind) : activitiesOrActivity[0];

  if (!activity) {
    return { existingSteps: [], shouldGenerate: false };
  }

  return resolveActivity(activity);
}

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
