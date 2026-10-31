import {
  type OptionPictureTarget,
  type StepImageOutcome,
  createStepImage,
  createStepOptionPicture,
  listLessonImageSteps,
  listLessonOptionPictures,
} from "@zoonk/core/library/media/lesson-images";

export type ImageAnalytics = Parameters<typeof createStepImage>[0]["analytics"];

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

  return createStepImage({ analytics, stepId });
}

export async function listLessonOptionPicturesStep(
  lessonId: string,
): Promise<OptionPictureTarget[]> {
  "use step";

  return listLessonOptionPictures({ lessonId });
}

/** One picture option per step, so a failed picture retries alone. */
export async function createStepOptionPictureStep({
  analytics,
  optionId,
  stepId,
}: OptionPictureTarget & { analytics?: ImageAnalytics }): Promise<StepImageOutcome> {
  "use step";

  return createStepOptionPicture({ analytics, optionId, stepId });
}
