import { getWorkflowMetadata } from "workflow";
import {
  type ImageAnalytics,
  createStepImageStep,
  listLessonImageStepsStep,
} from "./steps/lesson-image-steps";

export type LessonImagesInput = {
  lessonId: string;
  /** Who the lesson was made for, so image costs add up per learner and goal. */
  analytics?: ImageAnalytics;
  /** Private courses get fewer pictures: only the first screens the writer marked. */
  maxImages?: number;
};

export type LessonImagesResult = { failed: number; generated: number; reused: number };

/** A lesson made for one learner gets one picture: the first screen the writer marked. */
export const PRIVATE_MAX_IMAGES = 1;

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
 * Gives a written lesson its pictures in the background: only the screens the
 * writer marked, at most one every two screens, each reused from an image of
 * the same scene when there is one. The lesson is readable before this ends;
 * a screen whose picture fails twice simply has none.
 */
export async function lessonImagesWorkflow({
  analytics,
  lessonId,
  maxImages,
}: LessonImagesInput): Promise<LessonImagesResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = { contentScope: "shared" as const, traceId: workflowRunId, ...analytics };
  const marked = await listLessonImageStepsStep(lessonId);
  const stepIds = maxImages === undefined ? marked : marked.slice(0, maxImages);

  const outcomes = await Promise.allSettled(
    stepIds.map((stepId) => createStepImageStep({ analytics: context, stepId })),
  );

  return countOutcomes(outcomes);
}
