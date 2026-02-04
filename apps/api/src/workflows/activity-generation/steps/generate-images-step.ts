import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type StepVisual } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

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

  const { data: results, error } = await safeAsync(() =>
    Promise.all(
      visuals.map((visual) => {
        if (visual.kind === "image") {
          return processImageVisual(visual, orgSlug);
        }
        return Promise.resolve(visual as StepVisualWithUrl);
      }),
    ),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateImages" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateImages" });

  return results;
}
