import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { prisma } from "@zoonk/db";
import { getString, toRecord } from "@zoonk/utils/json";
import { rejected } from "@zoonk/utils/settled";
import { streamStatus } from "../stream-status";
import { type StepVisual } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type StepVisualWithUrl = StepVisual & { url?: string };

type ImageStep = { id: bigint | number; content: unknown };

async function generateAndSaveImages({
  imageSteps,
  language,
  orgSlug,
}: {
  imageSteps: ImageStep[];
  language: string;
  orgSlug?: string;
}): Promise<{
  hadFailure: boolean;
  results: PromiseSettledResult<{ data: string | null; error: Error | null }>[];
}> {
  const results = await Promise.allSettled(
    imageSteps.map((step) => {
      const prompt = getString(step.content, "prompt");
      if (!prompt) {
        return Promise.reject(new Error("Missing prompt"));
      }
      return generateVisualStepImage({ language, orgSlug, prompt });
    }),
  );

  const updateResults = await Promise.allSettled(
    imageSteps.map((step, idx) => {
      const result = results[idx];
      if (result?.status !== "fulfilled" || result.value.error) {
        return Promise.resolve();
      }
      return prisma.step.update({
        data: { content: { ...toRecord(step.content), url: result.value.data } },
        where: { id: step.id },
      });
    }),
  );

  const hadFailure = rejected(results) || rejected(updateResults);

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

    const dbStep = imageSteps.find((step) => getString(step.content, "prompt") === visual.prompt);

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

export async function generateImagesForActivityStep(
  activity: LessonActivity,
  visuals: StepVisual[],
): Promise<StepVisualWithUrl[]> {
  "use step";

  if (visuals.length === 0) {
    await streamStatus({ status: "started", step: "generateImages" });
    await streamStatus({ status: "completed", step: "generateImages" });
    return [];
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return [];
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, id: true },
    where: { activityId: activity.id, kind: "visual" },
  });

  const imageSteps = dbSteps.filter((step) => getString(step.content, "kind") === "image");

  if (imageSteps.length === 0) {
    await streamStatus({ status: "started", step: "generateImages" });
    await streamStatus({ status: "completed", step: "generateImages" });
    return visuals;
  }

  await streamStatus({ status: "started", step: "generateImages" });

  const { hadFailure, results } = await generateAndSaveImages({
    imageSteps,
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
  });

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }

  await streamStatus({ status: "completed", step: "generateImages" });

  return buildVisualsWithUrls(visuals, imageSteps, results);
}
