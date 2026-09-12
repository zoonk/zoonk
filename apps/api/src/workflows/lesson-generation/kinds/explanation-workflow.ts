import { prepareLessonIllustrations } from "../prepare-lesson-illustrations";
import { generateExplanationContentStep } from "../steps/generate-explanation-content-step";
import { generateImagePromptsStep } from "../steps/generate-image-prompts-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveExplanationLessonStep } from "../steps/save-static-lesson-step";

/**
 * Explanation lessons become source material for later practice and quiz
 * lessons. Text is saved atomically, then the selected useful illustration is
 * prepared before completion; failures recover independently from saved text.
 */
export async function explanationLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const { steps } = await generateExplanationContentStep(context);
  const { alts, prompts } = await generateImagePromptsStep({ context, steps });
  await saveExplanationLessonStep({ context, images: steps.map(() => null), steps });

  await prepareLessonIllustrations({ alts, context, prompts });
}
