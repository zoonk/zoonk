import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityKind } from "@zoonk/db";
import { streamStatus } from "../stream-status";
import { type StepVisual } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";

export type StepVisualWithUrl = StepVisual & { url?: string };

async function processImageVisual(
  visual: Extract<StepVisual, { kind: "image" }>,
  orgSlug: string,
): Promise<StepVisualWithUrl> {
  const { data: url, error } = await generateVisualStepImage({
    orgSlug,
    prompt: visual.prompt,
  });

  if (error) {
    return visual;
  }

  return { ...visual, url };
}

export async function generateImagesStep(
  activities: LessonActivity[],
  visuals: StepVisual[],
  activityKind: ActivityKind,
): Promise<StepVisualWithUrl[]> {
  "use step";

  const activity = activities.find((a) => a.kind === activityKind);

  if (!activity || visuals.length === 0) {
    return [];
  }

  if (activity.generationStatus === "completed") {
    return [];
  }

  await streamStatus({ status: "started", step: "generateImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;

  const settledResults = await Promise.allSettled(
    visuals.map((visual) => {
      if (visual.kind === "image") {
        return processImageVisual(visual, orgSlug);
      }
      return Promise.resolve(visual as StepVisualWithUrl);
    }),
  );

  const results = visuals.map((visual, index) => {
    const result = settledResults[index];

    if (result?.status === "fulfilled") {
      return result.value;
    }

    // If rejected, return original visual without URL
    return { ...visual };
  });

  await streamStatus({ status: "completed", step: "generateImages" });

  return results;
}
