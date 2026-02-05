import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityKind, prisma } from "@zoonk/db";
import { getString, toRecord } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
import { type StepVisual } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisualWithUrl = StepVisual & { url?: string };

function hasImageUrl(content: unknown): boolean {
  return getString(content, "url") !== null;
}

export async function generateImagesStep(
  activities: LessonActivity[],
  visuals: StepVisual[],
  activityKind: ActivityKind,
): Promise<StepVisualWithUrl[]> {
  "use step";

  const activity = activities.find((act) => act.kind === activityKind);

  if (!activity || visuals.length === 0) {
    return [];
  }

  // Query current DB state for incremental resume
  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, visualContent: true, visualKind: true },
    where: { activityId: activity.id },
  });

  if (dbSteps.length === 0) {
    return [];
  }

  // Find image steps missing URLs (incremental)
  const needingImages = dbSteps.filter(
    (step) => step.visualKind === "image" && !hasImageUrl(step.visualContent),
  );

  // All images already have URLs - return existing visuals as-is
  if (needingImages.length === 0) {
    return visuals.map((visual) => {
      const dbStep = dbSteps[visual.stepIndex];
      const url = dbStep ? getString(dbStep.visualContent, "url") : null;
      if (visual.kind === "image" && url) {
        return { ...visual, url };
      }
      return visual;
    });
  }

  await streamStatus({ status: "started", step: "generateImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;
  let hadFailure = false;

  // Phase 1: Generate missing images in parallel
  const imageResults = await Promise.allSettled(
    needingImages.map((step) => {
      const prompt = getString(step.visualContent, "prompt");
      if (!prompt) {
        return Promise.reject(new Error("Missing prompt"));
      }
      return generateVisualStepImage({ orgSlug, prompt });
    }),
  );

  // Phase 2: Update DB with generated URLs in parallel
  const updateResults = await Promise.allSettled(
    needingImages.map((step, idx) => {
      const result = imageResults[idx];
      if (result?.status !== "fulfilled" || result.value.error) {
        hadFailure = true;
        return Promise.resolve();
      }
      return prisma.step.update({
        data: {
          visualContent: {
            ...toRecord(step.visualContent),
            url: result.value.data,
          },
        },
        where: { id: step.id },
      });
    }),
  );

  if (updateResults.some((result) => result.status === "rejected")) {
    hadFailure = true;
  }

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }

  await streamStatus({ status: "completed", step: "generateImages" });

  // Build return visuals with URLs where available
  return visuals.map((visual) => {
    if (visual.kind !== "image") {
      return visual;
    }

    const dbStep = needingImages.find(
      (step) => getString(step.visualContent, "prompt") === visual.prompt,
    );

    if (!dbStep) {
      return visual;
    }

    const idx = needingImages.indexOf(dbStep);
    const result = imageResults[idx];

    if (result?.status === "fulfilled" && !result.value.error) {
      return { ...visual, url: result.value.data };
    }

    return visual;
  });
}
