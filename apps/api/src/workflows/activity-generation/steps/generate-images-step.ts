import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type StepVisual } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisualWithUrl = StepVisual & { url?: string };

function hasImageUrl(content: unknown): boolean {
  return typeof (content as Record<string, unknown>)?.url === "string";
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
    (s) => s.visualKind === "image" && !hasImageUrl(s.visualContent),
  );

  // All images already have URLs - return existing visuals as-is
  if (needingImages.length === 0) {
    return visuals.map((v) => {
      const dbStep = dbSteps[v.stepIndex];
      if (v.kind === "image" && dbStep && hasImageUrl(dbStep.visualContent)) {
        const content = dbStep.visualContent as Record<string, unknown>;
        return { ...v, url: content.url as string };
      }
      return v;
    });
  }

  await streamStatus({ status: "started", step: "generateImages" });

  const orgSlug = activity.lesson.chapter.course.organization.slug;
  let hadFailure = false;

  // Phase 1: Generate missing images in parallel
  const imageResults = await Promise.allSettled(
    needingImages.map((s) => {
      const content = s.visualContent as Record<string, unknown>;
      return generateVisualStepImage({ orgSlug, prompt: content.prompt as string });
    }),
  );

  // Phase 2: Update DB with generated URLs in parallel
  const updateResults = await Promise.allSettled(
    needingImages.map((s, i) => {
      const result = imageResults[i];
      if (result?.status !== "fulfilled" || result.value.error) {
        hadFailure = true;
        return Promise.resolve();
      }
      return prisma.step.update({
        data: {
          visualContent: {
            ...(s.visualContent as Record<string, unknown>),
            url: result.value.data,
          },
        },
        where: { id: s.id },
      });
    }),
  );

  // Check for update failures too
  if (updateResults.some((r) => r.status === "rejected")) {
    hadFailure = true;
  }

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }

  await streamStatus({ status: "completed", step: "generateImages" });

  // Build return visuals with URLs where available
  return visuals.map((visual, _index) => {
    if (visual.kind !== "image") {
      return visual as StepVisualWithUrl;
    }

    const dbStep = needingImages.find((s) => {
      const content = s.visualContent as Record<string, unknown>;
      return content.prompt === visual.prompt;
    });

    if (!dbStep) {
      return visual as StepVisualWithUrl;
    }

    const idx = needingImages.indexOf(dbStep);
    const result = imageResults[idx];

    if (result?.status === "fulfilled" && !result.value.error) {
      return { ...visual, url: result.value.data } as StepVisualWithUrl;
    }

    return visual as StepVisualWithUrl;
  });
}
