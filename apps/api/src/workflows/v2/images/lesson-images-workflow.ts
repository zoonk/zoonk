import { getWorkflowMetadata } from "workflow";
import {
  type ImageAnalytics,
  createStepImageStep,
  listLessonImageStepsStep,
} from "./steps/lesson-image-steps";
import { checkPictureStep } from "./steps/picture-check-steps";

export type LessonImagesInput = {
  lessonId: string;
  /** Who the lesson was made for, so image costs add up per learner and goal. */
  analytics?: ImageAnalytics;
};

export type LessonImagesResult = { failed: number; generated: number; reused: number };

function countOutcomes(
  outcomes: PromiseSettledResult<Awaited<ReturnType<typeof createStepImageStep>>>[],
): LessonImagesResult {
  const statuses = outcomes.map((outcome) =>
    outcome.status === "fulfilled" ? outcome.value.status : "failed",
  );

  return {
    failed: statuses.filter((status) => status === "failed").length,
    generated: statuses.filter((status) => status === "generated").length,
    reused: statuses.filter((status) => status === "reused").length,
  };
}

/**
 * Gives a written lesson its pictures in the background, all at once: a screen asks for a picture
 * only when it needs one (the learner would otherwise have to imagine what it shows, or a question
 * is about it), so every one is drawn, each reused from an image of the same scene when there is
 * one. The lesson opens before this ends and the player shows each picture as it arrives, before
 * its model check: the checks run once every picture is linked, and one that fails is redrawn and
 * replaced (`checkImageAsset`); a screen whose redraws fail too shows its description instead.
 */
export async function lessonImagesWorkflow({
  analytics,
  lessonId,
}: LessonImagesInput): Promise<LessonImagesResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = { contentScope: "shared" as const, traceId: workflowRunId, ...analytics };
  const stepIds = await listLessonImageStepsStep(lessonId);

  const outcomes = await Promise.allSettled(
    stepIds.map((stepId) => createStepImageStep({ analytics: context, stepId })),
  );

  // Each new picture shows as soon as it's linked; its model check follows, at flex.
  await Promise.allSettled(
    outcomes.flatMap((outcome) =>
      outcome.status === "fulfilled" && outcome.value.status === "generated"
        ? [checkPictureStep({ analytics: context, assetId: outcome.value.mediaAssetId })]
        : [],
    ),
  );

  return countOutcomes(outcomes);
}
