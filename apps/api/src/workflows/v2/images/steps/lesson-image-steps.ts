import {
  type StepImageOutcome,
  createStepImage,
  listLessonImageSteps,
} from "@zoonk/core/library/media/lesson-images";
import { withAiRetry } from "../../_shared/ai-retry";

export type ImageAnalytics = Parameters<typeof createStepImage>[0]["analytics"];

/** Reads the lesson right before drawing, so a retry never draws a screen that already has a picture. */
export async function listLessonImageStepsStep(lessonId: string): Promise<string[]> {
  "use step";

  return listLessonImageSteps({ lessonId });
}

/** One screen per step, so a failed image retries alone without redrawing the others. */
export async function createStepImageStep({
  analytics,
  stepId,
}: {
  analytics?: ImageAnalytics;
  stepId: string;
}): Promise<StepImageOutcome> {
  "use step";

  return withAiRetry(() => createStepImage({ analytics, stepId }));
}
