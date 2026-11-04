import { getWorkflowMetadata } from "workflow";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { checkPicture } from "./check-picture";
import {
  type ImageAnalytics,
  createStepImageStep,
  createStepOptionPictureStep,
  listLessonImageStepsStep,
  listLessonOptionPicturesStep,
} from "./steps/lesson-image-steps";

export type LessonImagesInput = { lessonId: string; analytics?: ImageAnalytics };

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

export async function lessonImagesWorkflow({
  analytics,
  lessonId,
}: LessonImagesInput): Promise<LessonImagesResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = { contentScope: "shared" as const, traceId: workflowRunId, ...analytics };
  const { conflict } = await claimRunToken(`lesson-images:${lessonId}`);

  if (conflict) {
    await joinRun(conflict);
  }

  const [stepIds, options] = await Promise.all([
    listLessonImageStepsStep(lessonId),
    listLessonOptionPicturesStep(lessonId),
  ]);

  const outcomes = await Promise.allSettled([
    ...stepIds.map((stepId) => createStepImageStep({ analytics: context, stepId })),
    ...options.map((option) => createStepOptionPictureStep({ analytics: context, ...option })),
  ]);

  await Promise.allSettled(
    outcomes.flatMap((outcome) =>
      outcome.status === "fulfilled" && outcome.value.status === "generated"
        ? [
            checkPicture({
              alt: outcome.value.alt,
              analytics: context,
              assetId: outcome.value.mediaAssetId,
            }),
          ]
        : [],
    ),
  );

  return countOutcomes(outcomes);
}
