import { getPracticeImagePrompts } from "../steps/_utils/get-practice-image-prompts";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { savePracticeLessonStep } from "../steps/save-practice-lesson-step";

/**
 * Practice content is generated from the explanation slice that has not fed a
 * previous practice lesson. That keeps each practice focused on the preceding
 * explanation group instead of drifting across the whole chapter.
 */
export async function practiceLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const content = await generatePracticeContentStep(context);
  const prompts = getPracticeImagePrompts({ scenario: content.scenario, steps: content.steps });
  const { images } = await generateStepImagesStep({ context, preset: "practice", prompts });

  await savePracticeLessonStep({ content, context, images });
}
