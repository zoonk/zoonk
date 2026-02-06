import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityKind, prisma } from "@zoonk/db";
import { getString, toRecord } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
import { type StepVisual } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisualWithUrl = StepVisual & { url?: string };

type ImageStep = { id: bigint | number; visualContent: unknown; visualKind: string | null };

async function generateAndSaveImages(
  imageSteps: ImageStep[],
  orgSlug: string,
): Promise<{
  hadFailure: boolean;
  results: PromiseSettledResult<{ data: string | null; error: Error | null }>[];
}> {
  const results = await Promise.allSettled(
    imageSteps.map((step) => {
      const prompt = getString(step.visualContent, "prompt");
      if (!prompt) {
        return Promise.reject(new Error("Missing prompt"));
      }
      return generateVisualStepImage({ orgSlug, prompt });
    }),
  );

  const updateResults = await Promise.allSettled(
    imageSteps.map((step, idx) => {
      const result = results[idx];
      if (result?.status !== "fulfilled" || result.value.error) {
        return Promise.resolve();
      }
      return prisma.step.update({
        data: { visualContent: { ...toRecord(step.visualContent), url: result.value.data } },
        where: { id: step.id },
      });
    }),
  );

  const hadFailure =
    results.some((result) => result.status === "rejected" || result.value.error) ||
    updateResults.some((result) => result.status === "rejected");

  return { hadFailure, results };
}

function buildVisualsWithUrls(
  visuals: StepVisual[],
  imageSteps: ImageStep[],
  results: PromiseSettledResult<{ data: string | null; error: Error | null }>[],
): StepVisualWithUrl[] {
  return visuals.map((visual) => {
    if (visual.kind !== "image") {
      return visual;
    }

    const dbStep = imageSteps.find(
      (step) => getString(step.visualContent, "prompt") === visual.prompt,
    );

    if (!dbStep) {
      return visual;
    }

    const idx = imageSteps.indexOf(dbStep);
    const result = results[idx];

    if (result?.status === "fulfilled" && !result.value.error && result.value.data) {
      return { ...visual, url: result.value.data };
    }

    return visual;
  });
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

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return [];
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, visualContent: true, visualKind: true },
    where: { activityId: activity.id },
  });

  const imageSteps = dbSteps.filter((step) => step.visualKind === "image");

  if (imageSteps.length === 0) {
    return visuals;
  }

  await streamStatus({ status: "started", step: "generateImages" });

  const { hadFailure, results } = await generateAndSaveImages(
    imageSteps,
    activity.lesson.chapter.course.organization.slug,
  );

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }

  await streamStatus({ status: "completed", step: "generateImages" });

  return buildVisualsWithUrls(visuals, imageSteps, results);
}
