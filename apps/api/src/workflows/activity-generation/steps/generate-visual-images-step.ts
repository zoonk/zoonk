import { type StepVisualSchema } from "@zoonk/ai/tasks/steps/visual";
import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivityContext } from "./get-activity-step";

type StepVisualResource = StepVisualSchema["visuals"][number];
export type VisualWithUrl = StepVisualResource & { url?: string };

async function processImageVisual(
  visual: Extract<StepVisualResource, { kind: "image" }>,
  orgSlug: string,
): Promise<VisualWithUrl> {
  const { data: url, error } = await generateVisualStepImage({
    orgSlug,
    prompt: visual.prompt,
  });

  if (error) {
    return visual;
  }

  return { ...visual, url };
}

export async function generateVisualImagesStep(
  context: ActivityContext,
  visuals: StepVisualResource[],
): Promise<VisualWithUrl[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateVisualImages" });

  const orgSlug = context.lesson.chapter.course.organization.slug;

  const { data: results, error } = await safeAsync(() =>
    Promise.all(
      visuals.map((visual) => {
        if (visual.kind === "image") {
          return processImageVisual(visual, orgSlug);
        }
        return Promise.resolve(visual as VisualWithUrl);
      }),
    ),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateVisualImages" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateVisualImages" });

  return results;
}
