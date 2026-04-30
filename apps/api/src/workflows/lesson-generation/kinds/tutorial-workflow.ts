import { generateImagePromptsStep } from "../steps/generate-image-prompts-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { generateTutorialContentStep } from "../steps/generate-tutorial-content-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveTutorialLessonStep } from "../steps/save-static-lesson-step";

/**
 * Tutorial lessons are self-contained procedural lessons, so they do not need
 * source explanation, vocabulary, or reading lessons before generation.
 */
export async function tutorialLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const { steps } = await generateTutorialContentStep(context);
  const { prompts } = await generateImagePromptsStep({ context, steps });
  const { images } = await generateStepImagesStep({ context, prompts });

  await saveTutorialLessonStep({ context, images, steps });
}
