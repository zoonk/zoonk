import { getPracticeImagePrompts } from "../steps/_utils/get-practice-image-prompts";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { savePracticeLessonStep } from "../steps/save-practice-lesson-step";

/**
 * Practice content is generated from the planned explanation metadata that has
 * not fed a previous practice lesson. That keeps each practice focused without
 * waiting for explanation content to finish generating.
 */
export async function practiceLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const content = await generatePracticeContentStep(context);
  const prompts = getPracticeImagePrompts({ scenario: content.scenario, steps: content.steps });
  const { images } = await generateStepImagesStep({ context, preset: "practice", prompts });

  await savePracticeLessonStep({ content, context, images });
}
