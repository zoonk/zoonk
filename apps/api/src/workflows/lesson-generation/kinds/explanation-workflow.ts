import { generateExplanationContentStep } from "../steps/generate-explanation-content-step";
import { generateImagePromptsStep } from "../steps/generate-image-prompts-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveExplanationLessonStep } from "../steps/save-static-lesson-step";

/**
 * Explanation lessons become source material for later practice and quiz
 * lessons. Saving the full generated step set only after images are available
 * prevents downstream lessons from reading partially generated teaching steps.
 */
export async function explanationLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const { steps } = await generateExplanationContentStep(context);
  const { prompts } = await generateImagePromptsStep({ context, steps });
  const { images } = await generateStepImagesStep({ context, prompts });

  await saveExplanationLessonStep({ context, images, steps });
}
